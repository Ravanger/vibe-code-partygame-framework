import { departedIds, isBelowMinimum, required, shuffle } from "@partygame/core";
import { allResponded } from "@partygame/core/kits";
import { META } from "./meta.js";
import { PHASE } from "./phaseNames.js";
import type { CrewContext } from "./private.js";
import { CHOICE_SLOT } from "./private.js";
import { ChoiceEntry, GuessEntry, PlayerPrivate, RevealEntry } from "./state.js";

/** The public roles dealt at the start of a game; there is one per possible seat. */
export const ROLES = ["Captain", "Engineer", "Navigator", "Medic", "Comms"] as const;
const SIGNAL_MIN = 1;
const SIGNAL_MAX = 9;
/** The crew's guesses in the Verdict before a wrong final guess loses. */
const MAX_GUESSES = 3;

type Choice = "share" | "hold";

/** Writes the shared rules' results into the synced state. One per hook call; holds no state of its own. */
export class Crew {
  constructor(private readonly ctx: CrewContext) {}

  remember(): void {
    for (const player of this.ctx.players()) {
      if (player.name) this.ctx.priv.names[player.id] = player.name;
      if (player.isActive && player.isReady) this.ctx.priv.participants.add(player.id);
    }
  }

  nameOf(playerId: string): string {
    return this.ctx.player(playerId)?.name ?? this.ctx.priv.names[playerId] ?? "";
  }

  /** Creates the player's private entry and reveals it to them. */
  mineOf(playerId: string): PlayerPrivate {
    const created = new PlayerPrivate();
    this.ctx.state.mine.set(playerId, created);
    this.ctx.showTo(playerId, created);
    return created;
  }

  resetMine(): void {
    for (const [playerId, entry] of this.ctx.state.mine) this.ctx.hideFrom(playerId, entry);
    this.ctx.state.mine.clear();
  }

  /** Drops the data of players who left for good and reveals their signal publicly; a dropped connection is not a departure. */
  pruneDeparted(): void {
    const { state, priv } = this.ctx;
    const departed = new Set(departedIds([...state.mine.keys(), ...state.roles.keys()], this.ctx));
    for (const [playerId, entry] of [...state.mine]) {
      if (!departed.has(playerId)) continue;
      this.ctx.hideFrom(playerId, entry);
      state.mine.delete(playerId);
    }
    for (const playerId of departed) {
      const signal = required(priv.signals[playerId], "leaver's signal");
      state.reveals.push(
        Object.assign(new RevealEntry(), { playerId, name: this.nameOf(playerId), signal }),
      );
      delete priv.signals[playerId];
      state.roles.delete(playerId);
      priv.responses.delete(playerId);
      priv.participants.delete(playerId);
      for (let i = state.choices.length - 1; i >= 0; --i) {
        if (state.choices[i]?.playerId === playerId) state.choices.splice(i, 1);
      }
    }
  }

  /** Deals a unique role (seeded shuffle, participant order) and a private signal to every starting player, and locks the target sum. */
  deal(): void {
    const { state, priv } = this.ctx;
    state.totalRounds = this.ctx.options.rounds;
    const ids = [...priv.participants];
    const roles = shuffle([...ROLES], this.ctx.rng);
    let target = 0;
    for (let i = 0; i < ids.length; ++i) {
      const id = required(ids[i], "participant");
      const signal = SIGNAL_MIN + Math.floor(this.ctx.rng() * (SIGNAL_MAX - SIGNAL_MIN + 1));
      priv.signals[id] = signal;
      target += signal;
      state.roles.set(id, required(roles[i], "dealt role"));
      this.mineOf(id).signal = signal;
    }
    priv.target = target;
  }

  activeIds(): string[] {
    return this.ctx.activePlayers().map((p) => p.id);
  }

  /** One slot per active player, all for the round choice. */
  slots(): Map<string, readonly string[]> {
    return new Map(this.activeIds().map((id) => [id, [CHOICE_SLOT]]));
  }

  roundComplete(): boolean {
    return allResponded(this.slots(), this.ctx.priv.responses, new Set(this.activeIds()));
  }

  /** Records the player's choice; a share reveals their signal to the whole room. */
  recordChoice(playerId: string, choice: Choice): void {
    const { state, priv } = this.ctx;
    priv.responses.set(playerId, new Map([[CHOICE_SLOT, choice]]));
    state.choices.push(
      Object.assign(new ChoiceEntry(), { playerId, name: this.nameOf(playerId), choice }),
    );
    if (choice === "share") {
      const signal = required(priv.signals[playerId], "player's signal");
      state.reveals.push(
        Object.assign(new RevealEntry(), { playerId, name: this.nameOf(playerId), signal }),
      );
    }
  }

  /** Moves to the next round (re-entering it restarts its timer) or to the Verdict after the final one. */
  advance(): void {
    const { state } = this.ctx;
    if (state.round >= state.totalRounds) this.ctx.transition(PHASE.Verdict);
    else this.ctx.transition(PHASE.Round);
  }

  /** Records a guess; a correct one wins, the final wrong one loses. */
  guess(playerId: string, value: number): void {
    const { state, priv } = this.ctx;
    const correct = value === priv.target;
    state.guesses.push(
      Object.assign(new GuessEntry(), { playerId, name: this.nameOf(playerId), value, correct }),
    );
    if (correct) this.finishGame(true);
    else if (state.guesses.length >= MAX_GUESSES) this.finishGame(false);
  }

  /** Reveals the outcome, the target and every signal, then moves to Results. */
  finishGame(won: boolean): void {
    const { state, priv } = this.ctx;
    state.outcome = won ? "win" : "lose";
    state.target = priv.target;
    for (const [playerId, signal] of Object.entries(priv.signals)) {
      state.reveals.push(
        Object.assign(new RevealEntry(), { playerId, name: this.nameOf(playerId), signal }),
      );
    }
    this.resetMine();
    this.ctx.transition(PHASE.Results);
  }

  endIfTooFewPlayers(): boolean {
    if (!isBelowMinimum(this.ctx, META.minPlayers)) return false;
    this.ctx.state.notice = `Fewer than ${META.minPlayers} players were left, so the game ended.`;
    this.ctx.returnToLobby();
    return true;
  }

  /** Clears everything for a fresh game after returning to the lobby. */
  clearGame(): void {
    const { state } = this.ctx;
    this.ctx.priv.clearGame();
    this.resetMine();
    state.round = 0;
    state.totalRounds = this.ctx.options.rounds;
    state.roles.clear();
    state.reveals.clear();
    state.choices.clear();
    state.guesses.clear();
    state.outcome = "";
    state.target = 0;
  }
}
