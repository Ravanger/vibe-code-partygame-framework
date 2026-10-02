import type { BaseGameState } from "@partygame/shared/schema";

/** What a strategy sees and can do during one stage. Everything here is dropped when the stage ends. */
export interface TerminalTurn<TState extends BaseGameState> {
  readonly state: TState;
  readonly playerId: string;
  readonly isHost: boolean;
  readonly signal: AbortSignal;
  /** The word that leaves the game, lowercase. */
  readonly quitWord: string;
  /** Trimmed answer; rejects when the stage ends. */
  ask(question: string): Promise<string>;
  print(line: string): void;
  /** Sends an action, prints `accepted` or the refusal; true when accepted. */
  send(type: string, payload: object, accepted: string): Promise<boolean>;
  /** Sends an action without waiting or printing (typing badges and the like). */
  notify(type: string, payload: object): void;
  /** Resolves on the next state change or when the stage ends. */
  changed(): Promise<void>;
  /** " 12s left" from the server clock, "" when the phase has no deadline. */
  timeLeft(): string;
  /** Leaves the game: `run()` resolves. */
  quit(): void;
}

/** A game's terminal screens: what to ask in each stage and what to say as the game moves. */
export interface TerminalStrategy<TState extends BaseGameState> {
  /** Plays one stage. Not called in the Lobby unless `lobby` is given. */
  play(turn: TerminalTurn<TState>): Promise<void>;
  /** A new stage starts when this changes; default `${phase}`. */
  stageOf?(state: TState): string;
  /** Lines to print on each state change (a commentator). */
  narrate?(state: TState): string[];
  /** Replaces the built-in lobby (host: Enter starts, q quits; guests: q quits). */
  lobby?(turn: TerminalTurn<TState>): Promise<void>;
}

export interface TerminalPlayerOptions {
  /** Clock for the deadline countdown; `Date.now` by default. */
  now?: () => number;
  /** What quits the built-in lobby; "q" by default. */
  quitWord?: string;
}
