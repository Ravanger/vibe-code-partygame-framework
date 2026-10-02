import { isServerError, type ServerError } from "@partygame/shared";
import { type GameDefinition, GameRuntime, type PhaseState, type PlayerInfo } from "../index.js";
import { FakeHost } from "./FakeHost.js";

/** Constructor argument of {@link TestTable}. */
export interface TestTableConfig<TState extends PhaseState, TPrivate, TOptions> {
  definition: GameDefinition<TState, TPrivate, TOptions>;
  /** A fresh synced state, e.g. `new MyState()`; plain objects work for `PhaseState`-only games. */
  state: TState;
  /** Already parsed room options. */
  options: TOptions;
  /** Seats p1..pN, p1 is the host; default 4. */
  players?: number;
}

/** A room driven through the real runtime with a manual clock. Extend it with your game's scenario steps. */
export class TestTable<TState extends PhaseState, TPrivate, TOptions> {
  readonly host = new FakeHost();
  readonly state: TState;
  readonly runtime: GameRuntime<TState, TPrivate, TOptions>;

  constructor(config: TestTableConfig<TState, TPrivate, TOptions>) {
    this.state = config.state;
    for (let i = 1; i <= (config.players ?? 4); ++i) this.host.seat(`p${i}`);
    this.runtime = new GameRuntime({
      definition: config.definition,
      state: config.state,
      options: config.options,
      host: this.host,
    });
  }

  get phase(): string {
    return this.state.phase;
  }

  get priv(): TPrivate {
    return this.runtime.priv;
  }

  /** Seat ids in seating order. */
  ids(): string[] {
    return this.host.seats.map((s) => s.id);
  }

  /** Dispatches `{ type, ...fields }`; returns the first rejection, if any. */
  act(
    playerId: string,
    type: string,
    fields: Record<string, unknown> = {},
  ): ServerError | undefined {
    return this.runtime.dispatch(playerId, { type, ...fields });
  }

  /** Every `ERROR` sent to `playerId`. */
  errors(playerId: string): ServerError[] {
    return this.host.errorsTo(playerId).filter(isServerError);
  }

  tick(ms: number): void {
    this.host.advance(ms);
  }

  /** The first seat sends `START_GAME`. */
  start(): ServerError | undefined {
    return this.act("p1", "START_GAME");
  }

  /** Removes the seat. */
  leave(playerId: string): void {
    this.host.kick(playerId);
    this.runtime.rosterChanged();
  }

  drop(playerId: string): void {
    this.seatOf(playerId).isConnected = false;
    this.runtime.rosterChanged();
  }

  rejoin(playerId: string): void {
    this.seatOf(playerId).isConnected = true;
    this.runtime.rosterChanged();
  }

  /** Seats a ready but inactive mid-game joiner. */
  joinLate(playerId: string): void {
    this.host.seat(playerId, { isActive: false });
    this.runtime.rosterChanged();
  }

  private seatOf(playerId: string): PlayerInfo {
    const seat = this.host.seats.find((s) => s.id === playerId);
    if (!seat) throw new Error(`No seat ${playerId}`);
    return seat;
  }
}
