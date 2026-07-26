import { type Client, CloseCode, Room } from "@colyseus/core";
import type { GameDefinition } from "@partygame/core";
import { buildXStateMachine } from "@partygame/core";
import { GameActionSchema, SetNameSchema } from "@partygame/shared";
import { type AnyActorRef, createActor } from "xstate";
import type { CategoryRepository } from "../../../games/wit-clash/src/content/CategoryRepository.js";
import { CategoryOptionSchema } from "../schema/CategoryOptionSchema.js";
import { GameStateSchema } from "../schema/GameStateSchema.js";
import { MatchupSchema } from "../schema/MatchupSchema.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import type { RoomCodeService } from "../services/RoomCodeService.js";
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
  categoryVoteMs: 500,
  promptMs: 5000,
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
      logger.debug("Machine state changed:", snapshot.value);
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
      name: "VOTE_CATEGORY",
      clientId: "__server__",
      role: "player",
      data: { categoryId: winnerId },
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
    const prompt = this.categories.randomPrompt(state.selectedCategory);
    if (!prompt) {
      logger.error(`No prompts found for category ${state.selectedCategory}`);
      return;
    }
    state.promptId = prompt.id;
    state.promptText = prompt.text;
    state.submittedAnswers.clear();
    state.phaseEndsAt = Date.now() + this.durations.promptMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.resolvePrompting(), this.durations.promptMs);
    logger.info(`Prompting started: "${prompt.text}", ${this.durations.promptMs}ms`);
  }

  private handleSubmitAnswer(
    client: Client,
    player: PlayerSchema,
    data: { matchupId: string; answer: string },
  ) {
    const state = this.state as GameStateSchema;
    if (state.phase !== "Prompting") return;
    if (state.submittedAnswers.has(client.sessionId)) return;
    state.submittedAnswers.set(client.sessionId, data.answer);
    logger.debug(`[SUBMIT_ANSWER] ${player.name} submitted answer`);
    if (this.allConnectedReadyPlayersSubmitted(state)) {
      this.resolvePrompting();
    }
  }

  private allConnectedReadyPlayersSubmitted(state: GameStateSchema): boolean {
    const connectedReady = Array.from(state.players.values()).filter(
      (p) => p.isConnected && p.isReady,
    );
    return (
      connectedReady.length > 0 && connectedReady.every((p) => state.submittedAnswers.has(p.id))
    );
  }

  private resolvePrompting() {
    this.clearPhaseTimer();
    const state = this.state as GameStateSchema;
    if (state.phase !== "Prompting") return;
    logger.info(`Prompting resolved: ${state.submittedAnswers.size} answers`);
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
    state.matchups.clear();
    state.playerVotes.clear();
    const answers = Array.from(state.submittedAnswers.entries());
    if (answers.length < 2) {
      logger.warn("Not enough answers for matchups, skipping voting");
      this.resolveVoting();
      return;
    }
    const shuffled = this.shuffleAnswers(answers);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const [playerA, answerA] = shuffled[i]!;
      const [playerB, answerB] = shuffled[i + 1]!;
      const matchup = new MatchupSchema();
      matchup.id = `m${i}`;
      matchup.answerAId = playerA;
      matchup.answerA = answerA;
      matchup.answerBId = playerB;
      matchup.answerB = answerB;
      matchup.votesA = 0;
      matchup.votesB = 0;
      state.matchups.push(matchup);
    }
    state.phaseEndsAt = Date.now() + this.durations.matchupVoteMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.resolveVoting(), this.durations.matchupVoteMs);
    logger.info(
      `Voting started: ${state.matchups.length} matchups, ${this.durations.matchupVoteMs}ms`,
    );
  }

  private shuffleAnswers(answers: Array<[string, string]>): Array<[string, string]> {
    const a = [...answers];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  private handleCastVote(client: Client, player: PlayerSchema, data: { answerId: string }) {
    const state = this.state as GameStateSchema;
    if (state.phase !== "Voting") return;
    const matchup = state.matchups.find(
      (m) => m.answerAId === data.answerId || m.answerBId === data.answerId,
    );
    if (!matchup) {
      logger.debug(`[CAST_VOTE] Unknown answer ${data.answerId} from ${client.sessionId}`);
      return;
    }
    if (matchup.answerAId === data.answerId) {
      matchup.votesA++;
    } else {
      matchup.votesB++;
    }
    state.playerVotes.set(client.sessionId, data.answerId);
    logger.debug(`[CAST_VOTE] ${player.name} voted for ${data.answerId}`);
    if (this.allConnectedReadyPlayersVotedMatchups(state)) {
      this.resolveVoting();
    }
  }

  private allConnectedReadyPlayersVotedMatchups(state: GameStateSchema): boolean {
    const connectedReady = Array.from(state.players.values()).filter(
      (p) => p.isConnected && p.isReady,
    );
    return connectedReady.length > 0 && connectedReady.every((p) => state.playerVotes.has(p.id));
  }

  private resolveVoting() {
    this.clearPhaseTimer();
    const state = this.state as GameStateSchema;
    if (state.phase !== "Voting") return;
    logger.info(`Voting resolved: ${state.playerVotes.size} votes`);
    this.machine.send({
      type: "ACTION",
      phase: "Voting",
      name: "RESOLVE_VOTING",
      clientId: "__server__",
      role: "host",
      data: undefined,
      timestamp: Date.now(),
    });
  }

  private enterResults() {
    const state = this.state as GameStateSchema;
    this.calculateScores(state);
    state.phaseEndsAt = Date.now() + this.durations.matchupRevealMs;
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => this.resolveResults(), this.durations.matchupRevealMs);
    logger.info(`Results started, revealing for ${this.durations.matchupRevealMs}ms`);
  }

  private calculateScores(state: GameStateSchema) {
    for (const matchup of state.matchups) {
      const winnerId = matchup.votesA >= matchup.votesB ? matchup.answerAId : matchup.answerBId;
      const currentScore = state.scores.get(winnerId) ?? 0;
      state.scores.set(winnerId, currentScore + 1);
    }
    logger.debug("Scores updated:", Object.fromEntries(state.scores));
  }

  private resolveResults() {
    this.clearPhaseTimer();
    const state = this.state as GameStateSchema;
    if (state.phase !== "Results") return;
    if (state.round >= state.maxRounds) {
      logger.info("Game over, final scores:", Object.fromEntries(state.scores));
      return;
    }
    state.round++;
    logger.info(`Starting round ${state.round}`);
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
    newHost.role = "host";
    logger.info(`Player ${newHost.name} promoted to host`);
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
        this._events.emit("dispose");
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
        state.players.delete(existingPlayer.id);
        existingPlayer.id = client.sessionId;
        existingPlayer.isConnected = true;
        state.players.set(client.sessionId, existingPlayer);
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
    if (this.roomCodeService) {
      const state = this.state as GameStateSchema;
      this.roomCodeService.unregister(state.roomCode);
    }
  }
}
