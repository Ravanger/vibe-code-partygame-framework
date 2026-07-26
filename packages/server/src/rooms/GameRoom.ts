import { type Client, CloseCode, Room } from "@colyseus/core";
import type { GameDefinition } from "@partygame/core";
import { buildXStateMachine } from "@partygame/core";
import { GameActionSchema, SetNameSchema } from "@partygame/shared";
import { type AnyActorRef, createActor } from "xstate";
import type { CategoryRepository } from "../../../../games/wit-clash/src/content/CategoryRepository.js";
import { shuffle } from "../../../../games/wit-clash/src/content/CategoryRepository.js";
import { AnswerSchema } from "../schema/AnswerSchema.js";
import { CategoryOptionSchema } from "../schema/CategoryOptionSchema.js";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { MatchupSchema } from "../schema/MatchupSchema.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import type { RoomCodeService } from "../services/RoomCodeService.js";
import { buildMatchups } from "./buildMatchups.js";
import { resolveCategoryVote } from "./resolveCategoryVote.js";

export interface PhaseDurations {
  categoryVoteMs: number;
  promptMs: number;
  matchupVoteMs: number;
  matchupRevealMs: number;
  emptyRoomGraceMs: number;
}

export const DEFAULT_DURATIONS: PhaseDurations = {
  categoryVoteMs: 60_000,
  promptMs: 90_000,
  matchupVoteMs: 20_000,
  matchupRevealMs: 5_000,
  emptyRoomGraceMs: 120_000,
};

export const TEST_DURATIONS: PhaseDurations = {
  categoryVoteMs: 80,
  promptMs: 80,
  matchupVoteMs: 60,
  matchupRevealMs: 30,
  emptyRoomGraceMs: 200,
};

const logger = {
  info: (message: string, ...args: unknown[]) =>
    console.log(`[GameRoom] INFO: ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) =>
    console.warn(`[GameRoom] WARN: ${message}`, ...args),
  error: (message: string, ...args: unknown[]) =>
    console.error(`[GameRoom] ERROR: ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) =>
    console.debug(`[GameRoom] DEBUG: ${message}`, ...args),
};

const _CloseCode = {
  CONSENTED: 4000,
  WITH_ERROR: 4001,
} as const;

export class GameRoom<TState = unknown> extends Room {
  private machine!: AnyActorRef;
  private gameDefinition!: GameDefinition<TState>;
  private roomCodeService: RoomCodeService | undefined;
  private categories: CategoryRepository | undefined;
  private durations: PhaseDurations;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private serverNowTimer: ReturnType<typeof setInterval> | null = null;
  private voteResolved = false;
  private promptResolved = false;
  private matchupResolved = false;
  private answerAuthors = new Map<string, string>();
  private assignments = new Map<string, string[]>();
  private drafts = new Map<string, string>();

  get rng(): () => number {
    return Math.random;
  }

  constructor(
    roomCodeService?: RoomCodeService,
    categories?: CategoryRepository,
    durations: PhaseDurations = DEFAULT_DURATIONS,
  ) {
    super();
    this.roomCodeService = roomCodeService;
    this.categories = categories;
    this.durations = durations;
  }

  getDurations(): PhaseDurations {
    return this.durations;
  }

  getCategories(): CategoryRepository | undefined {
    return this.categories;
  }

  setDefinition(def: GameDefinition<TState>) {
    this.gameDefinition = def;
  }

  onCreate() {
    logger.info("onCreate called");
    this.autoDispose = false;
    const state = new GameStateSchema();

    // Generate and register room code
    if (this.roomCodeService) {
      const code = this.roomCodeService.generateAndRegister(this.roomId);
      state.roomCode = code;
      logger.debug("Generated room code:", code);
    } else {
      // Fallback for backward compatibility
      state.roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    state.serverNow = Date.now();

    this.setState(state);
    logger.debug("Room code generated:", state.roomCode);

    if (!this.gameDefinition) {
      logger.error("gameDefinition is undefined in onCreate!");
      throw new Error(
        "GameDefinition must be set before onCreate completes. Call setDefinition() in your room class constructor or onCreate().",
      );
    }
    logger.debug("gameDefinition set:", this.gameDefinition.name);

    this.machine = createActor(buildXStateMachine(this.gameDefinition));
    this.machine.subscribe((snapshot) => {
      const state = this.state as GameStateSchema;
      const prevPhase = state.phase;
      state.phase = snapshot.context.currentPhase;
      state.publicData = JSON.stringify(snapshot.context.gameState);
      this.handlePhaseTransition(prevPhase, state.phase);
    });
    this.machine.start();

    // Update serverNow every second for smooth countdowns
    this.serverNowTimer = setInterval(() => {
      const state = this.state as GameStateSchema;
      state.serverNow = Date.now();
    }, 1000);

    this.onMessage("SET_NAME", (client, name: string) => {
      this.handleSetName(client, name);
    });

    this.onMessage("ACTION", (client, message: unknown) => {
      logger.debug(`Received ACTION from ${client.sessionId}:`, message);
      const parsedAction = GameActionSchema.safeParse(message);
      if (!parsedAction.success) {
        logger.error(`Invalid action format from ${client.sessionId}:`, parsedAction.error);
        client.send("ERROR", { code: "INVALID_ACTION", message: "Invalid action format" });
        return;
      }

      const state = this.state as GameStateSchema;
      const player = state.players.get(client.sessionId);
      if (!player) {
        logger.error(`Player not found for ${client.sessionId}`);
        return;
      }

      // Handle category voting directly (not through XState)
      if (state.phase === "CategorySelection" && parsedAction.data.type === "VOTE_CATEGORY") {
        this.handleVoteCategory(client, player, parsedAction.data as { categoryId: string });
        return;
      }

      // Handle prompting directly (not through XState)
      if (state.phase === "Prompting" && parsedAction.data.type === "SUBMIT_ANSWER") {
        this.handleSubmitAnswer(
          client,
          player,
          parsedAction.data as { matchupId: string; answer: string },
        );
        return;
      }

      // Handle voting directly (not through XState)
      if (state.phase === "Voting" && parsedAction.data.type === "CAST_VOTE") {
        this.handleCastVote(client, player, parsedAction.data as { answerId: string });
        return;
      }

      const phase = this.gameDefinition.phases[state.phase];
      if (!phase) {
        logger.error(`Phase ${state.phase} not found in game definition`);
        return;
      }
      const actionDef = phase.actions[parsedAction.data.type];
      if (!actionDef) {
        logger.error(`Action ${parsedAction.data.type} not found in phase ${state.phase}`);
        return;
      }

      if (actionDef.from !== "player" && player.role !== actionDef.from) {
        logger.error(`Unauthorized action ${parsedAction.data.type} from ${client.sessionId}`);
        client.send("ERROR", { code: "UNAUTHORIZED", message: "Forbidden" });
        return;
      }

      logger.debug(`Sending action to machine: ${parsedAction.data.type}`);
      this.machine.send({
        type: "ACTION",
        phase: state.phase,
        name: parsedAction.data.type,
        clientId: client.sessionId,
        role: player.role,
        data: parsedAction.data,
        timestamp: Date.now(),
      });
    });
  }

  handleSetName(client: Client, raw: unknown) {
    const parsed = SetNameSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(`[SET_NAME] Invalid name from ${client.sessionId}`);
      return;
    }
    logger.debug(`Received SET_NAME from ${client.sessionId}:`, parsed.data);
    const state = this.state as GameStateSchema;
    const player = state.players.get(client.sessionId);
    if (!player) {
      logger.warn(`[SET_NAME] Unknown session ${client.sessionId}`);
      return;
    }
    player.name = parsed.data;
    player.isReady = true;
    logger.info(`Player ${client.sessionId} name set to ${parsed.data}`);

    this.checkAutoStart(state);
  }

  private checkAutoStart(state: GameStateSchema) {
    if (state.phase !== "Lobby") return;
    const readyCount = Array.from(state.players.values()).filter((p) => p.isReady).length;
    if (readyCount >= this.gameDefinition.minPlayers) {
      logger.info(
        `Auto-starting game: ${readyCount} players ready (min: ${this.gameDefinition.minPlayers})`,
      );
      this.machine.send({
        type: "ACTION",
        phase: "Lobby",
        name: "START_GAME",
        clientId: "__auto__",
        role: "host",
        data: undefined,
        timestamp: Date.now(),
      });
    }
  }

  private handlePhaseTransition(_prevPhase: string, nextPhase: string) {
    if (nextPhase === "CategorySelection") {
      this.enterCategorySelection();
    }
    if (nextPhase === "Prompting") {
      this.enterPrompting();
    }
    if (nextPhase === "Voting") {
      this.enterVoting();
    }
    if (nextPhase === "Results") {
      this.enterResults();
    }
  }

  private enterCategorySelection() {
    if (!this.categories) {
      logger.error("Cannot enter CategorySelection: no categories configured");
      return;
    }
    const state = this.state as GameStateSchema;

    const picked = this.categories.pickRandom(3);
    state.categoryOptions.clear();
    for (const cat of picked) {
      const opt = new CategoryOptionSchema();
      opt.id = cat.id;
      opt.name = cat.name;
      opt.emoji = cat.emoji;
      opt.votes = 0;
      state.categoryOptions.push(opt);
    }

    state.categoryVotes.clear();
    this.voteResolved = false;
    state.phaseEndsAt = Date.now() + this.durations.categoryVoteMs;

    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.resolveCategoryVote(), this.durations.categoryVoteMs);

    logger.info(
      `CategorySelection started: ${state.categoryOptions.length} options, ${this.durations.categoryVoteMs}ms`,
    );
  }

  private handleVoteCategory(client: Client, player: PlayerSchema, data: { categoryId: string }) {
    const state = this.state as GameStateSchema;
    if (state.phase !== "CategorySelection") return;
    if (this.voteResolved) return;

    const option = state.categoryOptions.find((o) => o.id === data.categoryId);
    if (!option) {
      logger.debug(`[VOTE_CATEGORY] Unknown category ${data.categoryId} from ${client.sessionId}`);
      return;
    }

    state.categoryVotes.set(client.sessionId, data.categoryId);
    this.recountCategoryVotes();

    logger.debug(`[VOTE_CATEGORY] ${player.name} voted for ${data.categoryId}`);

    if (this.allConnectedReadyPlayersVoted(state)) {
      this.resolveCategoryVote();
    }
  }

  private recountCategoryVotes() {
    const state = this.state as GameStateSchema;
    const tally = new Map<string, number>();
    for (const id of state.categoryVotes.values()) {
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    for (const o of state.categoryOptions) {
      o.votes = tally.get(o.id) ?? 0;
    }
  }

  private allConnectedReadyPlayersVoted(state: GameStateSchema): boolean {
    const connectedReady = Array.from(state.players.values()).filter(
      (p) => p.isConnected && p.isReady,
    );
    return connectedReady.length > 0 && connectedReady.every((p) => state.categoryVotes.has(p.id));
  }

  private resolveCategoryVote() {
    if (this.voteResolved) return;
    this.voteResolved = true;

    this.clearPhaseTimer();
    const state = this.state as GameStateSchema;
    if (state.phase !== "CategorySelection") return;

    const options = Array.from(state.categoryOptions).map((o) => ({ id: o.id, votes: o.votes }));
    const winnerId = resolveCategoryVote(options, Math.random);
    state.selectedCategory = winnerId;

    state.categoryVotes.clear();
    state.categoryOptions.clear();

    this.machine.send({
      type: "ACTION",
      phase: "CategorySelection",
      name: "RESOLVE_CATEGORY_VOTE",
      clientId: "__server__",
      role: "host",
      data: undefined,
      timestamp: Date.now(),
    });

    logger.info(`CategoryVote resolved: ${winnerId}`);
  }

  private enterPrompting() {
    const state = this.state as GameStateSchema;
    if (!this.categories || !state.selectedCategory) {
      logger.error("Cannot enter Prompting: no categories or selected category");
      return;
    }

    state.matchups.clear();
    this.answerAuthors.clear();
    this.assignments.clear();
    this.drafts.clear();
    this.promptResolved = false;
    state.roundNumber = Math.max(1, state.roundNumber + 1);

    const players = [...state.players.values()].filter((p) => p.isConnected && p.isReady);
    const category = this.categories.byId(state.selectedCategory);
    const planned = buildMatchups(
      players.map((p) => p.id),
      category?.prompts ?? [],
      this.rng,
    );

    for (const pm of planned) {
      const m = new MatchupSchema();
      m.id = crypto.randomUUID();
      m.index = pm.index;
      m.promptText = pm.promptText;
      m.isRevealed = false;
      state.matchups.push(m);
      for (const authorId of pm.authorIds) {
        const list = this.assignments.get(authorId) ?? [];
        list.push(m.id);
        this.assignments.set(authorId, list);
      }
    }

    state.answersSubmitted = 0;
    state.answersExpected = [...this.assignments.values()].reduce((n, l) => n + l.length, 0);

    this.sendPromptsToAll();
    state.phaseEndsAt = Date.now() + this.durations.promptMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.finishPrompting(), this.durations.promptMs);
    logger.info(
      `Prompting started: ${state.matchups.length} matchups, ${state.answersExpected} answers expected, ${this.durations.promptMs}ms`,
    );
  }

  private sendPromptsToAll() {
    for (const client of this.clients) this.sendPromptsTo(client);
  }

  private sendPromptsTo(client: Client) {
    const state = this.state as GameStateSchema;
    const mine = (this.assignments.get(client.sessionId) ?? []).map((matchupId) => ({
      matchupId,
      promptText: state.matchups.find((m) => m.id === matchupId)?.promptText ?? "",
    }));
    if (mine.length) client.send("YOUR_PROMPTS", mine);
  }

  private handleSubmitAnswer(
    client: Client,
    _player: PlayerSchema,
    data: { matchupId: string; answer: string },
  ) {
    const state = this.state as GameStateSchema;
    if (this.promptResolved || state.phase !== "Prompting") return;

    const player = state.players.get(client.sessionId);
    if (!player?.isConnected) return;

    if (!(this.assignments.get(client.sessionId) ?? []).includes(data.matchupId)) {
      logger.warn(`[SUBMIT_ANSWER] ${client.sessionId} is not an author of ${data.matchupId}`);
      return;
    }

    const key = `${data.matchupId}:${client.sessionId}`;
    const isNew = !this.drafts.has(key);
    this.drafts.set(key, data.answer);

    if (isNew) state.answersSubmitted += 1;
    logger.debug(
      `[SUBMIT_ANSWER] ${player.name} submitted answer (${state.answersSubmitted}/${state.answersExpected})`,
    );

    if (state.answersSubmitted >= state.answersExpected) this.finishPrompting();
  }

  private finishPrompting() {
    if (this.promptResolved) return;
    this.promptResolved = true;
    this.clearPhaseTimer();

    const state = this.state as GameStateSchema;
    if (state.phase !== "Prompting") return;

    for (const m of state.matchups) {
      const authors = [...this.assignments.entries()]
        .filter(([, ids]) => ids.includes(m.id))
        .map(([sessionId]) => sessionId);

      const built = authors.map((sessionId) => {
        const a = new AnswerSchema();
        a.id = crypto.randomUUID();
        a.text = this.drafts.get(`${m.id}:${sessionId}`) ?? "(no answer)";
        a.votes = 0;
        a.authorId = "";
        this.answerAuthors.set(a.id, sessionId);
        return a;
      });

      for (const a of shuffle(built, this.rng)) m.answers.push(a);
    }

    state.phaseEndsAt = 0;
    logger.info(`Prompting resolved: ${state.answersSubmitted} answers submitted`);
    this.machine.send({
      type: "ACTION",
      phase: "Prompting",
      name: "RESOLVE_PROMPTING",
      clientId: "__server__",
      role: "host",
      data: undefined,
      timestamp: Date.now(),
    });
  }

  private enterVoting() {
    const state = this.state as GameStateSchema;
    state.activeMatchupIndex = -1;
    state.isRevealing = false;
    state.answerVotes.clear();
    this.matchupResolved = false;
    this.startNextMatchup();
    logger.info(`Voting started: ${state.matchups.length} matchups ready`);
  }

  private startNextMatchup() {
    const state = this.state as GameStateSchema;
    const next = state.activeMatchupIndex + 1;

    if (next >= state.matchups.length) {
      state.activeMatchupIndex = -1;
      state.isRevealing = false;
      state.phaseEndsAt = 0;
      this.machine.send({
        type: "ACTION",
        phase: "Voting",
        name: "RESOLVE_VOTING",
        clientId: "__server__",
        role: "host",
        data: undefined,
        timestamp: Date.now(),
      });
      return;
    }

    state.activeMatchupIndex = next;
    state.isRevealing = false;
    state.answerVotes.clear();
    const matchup = state.matchups[next];
    if (matchup) {
      for (const a of matchup.answers) a.votes = 0;
    }
    this.matchupResolved = false;

    if (this.eligibleVoters(next).length === 0) {
      this.revealMatchup();
      return;
    }

    state.phaseEndsAt = Date.now() + this.durations.matchupVoteMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.revealMatchup(), this.durations.matchupVoteMs);
  }

  private eligibleVoters(index: number): PlayerSchema[] {
    const state = this.state as GameStateSchema;
    const matchup = state.matchups[index];
    if (!matchup) return [];
    const authors = new Set(matchup.answers.map((a) => this.answerAuthors.get(a.id)));
    return [...state.players.values()].filter(
      (p) => p.isConnected && p.isReady && !authors.has(p.id),
    );
  }

  private handleCastVote(client: Client, _player: PlayerSchema, data: { answerId: string }) {
    const state = this.state as GameStateSchema;
    if (state.phase !== "Voting" || state.isRevealing || this.matchupResolved) return;

    const matchup = state.matchups[state.activeMatchupIndex];
    if (!matchup) return;

    const answer = matchup.answers.find((a) => a.id === data.answerId);
    if (!answer) {
      logger.warn(`[CAST_VOTE] ${data.answerId} is not in the active matchup`);
      return;
    }

    if (!this.eligibleVoters(state.activeMatchupIndex).some((p) => p.id === client.sessionId)) {
      logger.warn(`[CAST_VOTE] ${client.sessionId} is not eligible for this matchup`);
      return;
    }

    state.answerVotes.set(client.sessionId, data.answerId);
    this.recountActiveMatchup();

    const eligible = this.eligibleVoters(state.activeMatchupIndex);
    if (eligible.every((p) => state.answerVotes.has(p.id))) this.revealMatchup();
  }

  private recountActiveMatchup() {
    const state = this.state as GameStateSchema;
    const matchup = state.matchups[state.activeMatchupIndex];
    if (!matchup) return;
    const tally = new Map<string, number>();
    for (const id of state.answerVotes.values()) tally.set(id, (tally.get(id) ?? 0) + 1);
    for (const a of matchup.answers) a.votes = tally.get(a.id) ?? 0;
  }

  private revealMatchup() {
    if (this.matchupResolved) return;
    this.matchupResolved = true;
    this.clearPhaseTimer();

    const state = this.state as GameStateSchema;
    const matchup = state.matchups[state.activeMatchupIndex];
    if (!matchup) return;

    for (const a of matchup.answers) a.authorId = this.answerAuthors.get(a.id) ?? "";
    matchup.isRevealed = true;
    state.isRevealing = true;

    this.awardMatchupPoints(matchup, this.eligibleVoters(state.activeMatchupIndex).length);

    state.phaseEndsAt = Date.now() + this.durations.matchupRevealMs;
    this.phaseTimer = setTimeout(() => this.startNextMatchup(), this.durations.matchupRevealMs);
  }

  private awardMatchupPoints(matchup: MatchupSchema, eligibleCount: number) {
    if (eligibleCount === 0) return;
    const state = this.state as GameStateSchema;
    const [a, b] = matchup.answers;
    if (!a || !b) return;
    if (a.votes === b.votes) return;
    const winnerAnswer = a.votes > b.votes ? a : b;
    const winnerId = this.answerAuthors.get(winnerAnswer.id);
    if (!winnerId) return;
    const points = Math.floor(eligibleCount * 0.5) + 1;
    const current = state.scores.get(winnerId) ?? 0;
    state.scores.set(winnerId, current + points);
    logger.debug(`[SCORING] ${winnerId} awarded ${points} points`);
  }

  private enterResults() {
    const state = this.state as GameStateSchema;
    // Plan 09 will implement scoring.
    state.phaseEndsAt = Date.now() + this.durations.matchupRevealMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.resolveResults(), this.durations.matchupRevealMs);
    logger.info(`Results started, revealing for ${this.durations.matchupRevealMs}ms`);
  }

  private resolveResults() {
    this.clearPhaseTimer();
    const state = this.state as GameStateSchema;
    if (state.phase !== "Results") return;
    state.roundNumber++;
    logger.info(`Starting round ${state.roundNumber}`);
    this.machine.send({
      type: "ACTION",
      phase: "Results",
      name: "NEXT_ROUND",
      clientId: "__server__",
      role: "host",
      data: undefined,
      timestamp: Date.now(),
    });
  }

  private clearPhaseTimer() {
    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private rekeyPromptingState(oldSessionId: string, newSessionId: string) {
    const assigned = this.assignments.get(oldSessionId);
    if (assigned) {
      this.assignments.delete(oldSessionId);
      this.assignments.set(newSessionId, assigned);
    }

    for (const [key, value] of this.drafts) {
      if (key.startsWith(`${oldSessionId}:`)) {
        this.drafts.delete(key);
        this.drafts.set(key.replace(oldSessionId, newSessionId), value);
      }
    }

    for (const [answerId, sessionId] of this.answerAuthors) {
      if (sessionId === oldSessionId) {
        this.answerAuthors.set(answerId, newSessionId);
      }
    }
  }

  private rekeyVotingState(oldSessionId: string, newSessionId: string) {
    const state = this.state as GameStateSchema;
    const vote = state.answerVotes.get(oldSessionId);
    if (vote !== undefined) {
      state.answerVotes.delete(oldSessionId);
      state.answerVotes.set(newSessionId, vote);
    }
  }

  onLeave(client: Client, code?: number) {
    logger.info(`Client ${client.sessionId} left (code=${code})`);
    const state = this.state as GameStateSchema;
    const player = state.players.get(client.sessionId);
    if (!player) {
      logger.warn(`[onLeave] Unknown session ${client.sessionId}`);
      return;
    }

    const isConsented = code === CloseCode.CONSENTED;
    if (isConsented) {
      state.players.delete(client.sessionId);
      this.reassignHostIfNeeded(state);
      this.scheduleDisposeIfEmpty(state);
    } else {
      player.isConnected = false;
      this.allowReconnection(client, 60);
      logger.info(`Player ${player.name} disconnected, seat held for reconnection`);
      this.scheduleDisposeIfEmpty(state);
    }
  }

  private reassignHostIfNeeded(state: GameStateSchema) {
    const players = Array.from(state.players.values());
    if (players.length === 0) return;
    const remainingHosts = players.filter((p) => p.role === "host");
    if (remainingHosts.length > 0) return;
    const newHost = players.find((p) => p.isConnected) || players[0];
    if (newHost) {
      newHost.role = "host";
      logger.info(`Player ${newHost.name} promoted to host`);
    }
  }

  private scheduleDisposeIfEmpty(state: GameStateSchema) {
    const hasConnectedPlayers = Array.from(state.players.values()).some((p) => p.isConnected);
    if (hasConnectedPlayers) return;
    const graceMs = this.durations.emptyRoomGraceMs;
    logger.info(`No connected players, scheduling room disposal in ${graceMs}ms`);
    setTimeout(() => {
      const stillEmpty = !Array.from(state.players.values()).some((p) => p.isConnected);
      if (stillEmpty) {
        this.lock();
        (this as unknown as { _events: { emit: (event: string) => void } })._events.emit("dispose");
      }
    }, graceMs);
  }

  onJoin(client: Client, options?: Record<string, unknown>) {
    logger.info(`onJoin called for client: ${client.sessionId}`);
    logger.debug(`Options: ${JSON.stringify(options)}`);

    if (!this.gameDefinition) {
      logger.error("gameDefinition is undefined in onJoin!");
      throw new Error(
        "GameDefinition must be set before clients can join. Call setDefinition() in your room class.",
      );
    }

    const state = this.state as GameStateSchema;
    const playerId = options?.playerId as string | undefined;
    logger.debug(`Current players before join: ${state.players.size}`);

    if (playerId) {
      const existingPlayer = Array.from(state.players.values()).find(
        (p) => p.playerId === playerId,
      );
      if (existingPlayer) {
        const oldSessionId = existingPlayer.id;
        state.players.delete(oldSessionId);
        existingPlayer.id = client.sessionId;
        existingPlayer.isConnected = true;
        state.players.set(client.sessionId, existingPlayer);

        // Re-key private maps if reconnecting during Prompting
        if (state.phase === "Prompting") {
          this.rekeyPromptingState(oldSessionId, client.sessionId);
          this.sendPromptsTo(client);
        }

        // Re-key votes if reconnecting during Voting
        if (state.phase === "Voting") {
          this.rekeyVotingState(oldSessionId, client.sessionId);
        }

        logger.info(`Client ${client.sessionId} reconnected as ${existingPlayer.name}`);
        return;
      }
    }

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.playerId = playerId ?? "";
    player.name = (options?.name as string) || `Player ${client.sessionId.slice(0, 4)}`;
    player.role = state.players.size === 0 ? "host" : "player";
    state.players.set(client.sessionId, player);

    logger.debug(`Player created: id=${player.id}, name=${player.name}, role=${player.role}`);
    logger.debug(`Total players after join: ${state.players.size}`);

    logger.info(`Client ${client.sessionId} joined as ${player.name}`);
  }

  onDispose() {
    logger.info(`OnDispose called for room ${this.roomId}`);
    this.clearPhaseTimer();
    if (this.serverNowTimer !== null) {
      clearInterval(this.serverNowTimer);
      this.serverNowTimer = null;
    }
    this.answerAuthors.clear();
    this.assignments.clear();
    this.drafts.clear();
    if (this.roomCodeService) {
      const state = this.state as GameStateSchema;
      this.roomCodeService.unregister(state.roomCode);
    }
  }
}
