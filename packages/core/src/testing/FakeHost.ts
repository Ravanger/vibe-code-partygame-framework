import type {
  Logger,
  LogLevel,
  LogLine,
  PlayerInfo,
  RuntimeHost,
  TimerHandle,
} from "../runtime/types.js";
import { MAX_TIMER_FIRES_PER_ADVANCE, TimerLimitError, TimerQueue } from "../timers.js";
import { type Seed, seedFromNumber, sfc32 } from "../utils.js";

/** A message `FakeHost` recorded as sent to one player. */
export interface Sent {
  playerId: string;
  type: string;
  payload: unknown;
}

/** A recording {@link RuntimeHost} with a manual clock, for driving the runtime in tests without a server. */
export class FakeHost implements RuntimeHost {
  readonly seats: PlayerInfo[] = [];
  readonly sent: Sent[] = [];
  readonly broadcasts: Array<{ type: string; payload: unknown }> = [];
  time = 1_000_000;
  activations = 0;
  readonly views: Array<{ op: "show" | "hide"; playerId: string; ref: object }> = [];
  readonly kicked: string[] = [];
  readonly published: unknown[] = [];
  readonly transitions: Array<{ from: string; to: string }> = [];
  /** Delivery lateness added to every timer, in ms — models a host clock that fires on a grid. 0 fires exactly on time. */
  timerLatenessMs = 0;
  /** Every line `ctx.log` wrote, in order. */
  readonly logs: LogLine[] = [];
  readonly log: Logger = {
    info: (event, fields) => this.record("info", event, fields),
    warn: (event, fields) => this.record("warn", event, fields),
    error: (event, fields) => this.record("error", event, fields),
  };
  /** Promotes the seat and demotes the current host (#36); delete it to simulate a host without `setHost`. */
  setHost?: (playerId: string) => void = (id) => {
    for (const seat of this.seats) {
      if (seat.id === id) seat.role = "host";
      else if (seat.role === "host") seat.role = "player";
    }
  };
  /** The room RNG seed; an unseeded host is `seedFromNumber(0)`, a deterministic stream. */
  readonly seed: Seed;
  private rngFn: () => number;
  private queue = new TimerQueue();
  private nextId = 1;
  /** Scopes each audience key has already used; cleared on every transition. */
  private readonly audienceScopes = new Map<string, Set<string>>();

  constructor(seed: Seed | number = 0) {
    this.seed = typeof seed === "number" ? seedFromNumber(seed) : seed;
    this.rngFn = sfc32(this.seed);
  }

  /** Adds a seat, the first one as host, with `overrides` applied over the connected, ready, active defaults. */
  seat(id: string, overrides: Partial<PlayerInfo> = {}): PlayerInfo {
    const info: PlayerInfo = {
      id,
      name: id,
      role: this.seats.length === 0 ? "host" : "player",
      isConnected: true,
      isReady: true,
      isActive: true,
      ...overrides,
    };
    this.seats.push(info);
    return info;
  }

  /** The number of timers scheduled and not yet fired or cleared. */
  get pendingTimers(): number {
    return this.queue.size;
  }

  /** The payloads of every `ERROR` message sent to `playerId`. */
  errorsTo(playerId: string): unknown[] {
    return this.sent
      .filter((s) => s.playerId === playerId && s.type === "ERROR")
      .map((s) => s.payload);
  }

  /** Advances the manual clock by `ms` milliseconds, firing every due timer in `(at, id)` order; one advance fires at most {@link MAX_TIMER_FIRES_PER_ADVANCE} timers, a larger jump throws {@link TimerLimitError}. */
  advance(ms: number): void {
    const target = this.time + ms;
    let fired = 0;
    for (;;) {
      const head = this.queue.peek();
      if (head === undefined || head.at > target) break;
      ++fired;
      if (fired > MAX_TIMER_FIRES_PER_ADVANCE) {
        throw new TimerLimitError(
          `FakeHost.advance would fire more than ${MAX_TIMER_FIRES_PER_ADVANCE} timers in one advance`,
        );
      }
      this.queue.shift();
      this.time = head.at;
      head.callback();
    }
    this.time = target;
  }

  /** {@inheritDoc RuntimeHost.players} */
  players(): PlayerInfo[] {
    return this.seats;
  }

  activateWaitingPlayers(): void {
    ++this.activations;
    for (const seat of this.seats) if (seat.isReady) seat.isActive = true;
  }

  benchUnreadyPlayers(): void {
    for (const seat of this.seats) if (!seat.isReady) seat.isActive = false;
  }

  /** {@inheritDoc RuntimeHost.send} */
  send(playerId: string, type: string, payload: unknown): void {
    this.sent.push({ playerId, type, payload });
  }

  /** {@inheritDoc RuntimeHost.broadcast} */
  broadcast(type: string, payload: unknown): void {
    this.broadcasts.push({ type, payload });
  }

  notifyTransition(from: string, to: string): void {
    this.transitions.push({ from, to });
    this.audienceScopes.clear();
  }

  audienceOnce(audienceKey: string, scope: string): boolean {
    const scopes = this.audienceScopes.get(audienceKey);
    if (scopes === undefined) {
      this.audienceScopes.set(audienceKey, new Set([scope]));
      return true;
    }
    if (scopes.has(scope)) return false;
    scopes.add(scope);
    return true;
  }

  /** {@inheritDoc RuntimeHost.showTo} */
  showTo(playerId: string, ref: object): void {
    this.views.push({ op: "show", playerId, ref });
  }

  /** {@inheritDoc RuntimeHost.hideFrom} */
  hideFrom(playerId: string, ref: object): void {
    this.views.push({ op: "hide", playerId, ref });
  }

  kick(playerId: string): void {
    this.kicked.push(playerId);
    const index = this.seats.findIndex((s) => s.id === playerId);
    if (index >= 0) this.seats.splice(index, 1);
  }

  publishOptions(options: unknown): void {
    this.published.push(options);
  }

  /** {@inheritDoc RuntimeHost.now} */
  now(): number {
    return this.time;
  }

  /** {@inheritDoc RuntimeHost.rng} */
  rng(): number {
    return this.rngFn();
  }

  /** {@inheritDoc RuntimeHost.setTimeout} */
  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.queue.push({ id, at: this.time + ms + this.timerLatenessMs, callback });
    return id as TimerHandle;
  }

  /** {@inheritDoc RuntimeHost.clearTimeout} */
  clearTimeout(handle: TimerHandle): void {
    this.queue.remove((t) => t.id === handle);
  }

  private record(level: LogLevel, event: string, fields?: LogLine["fields"]): void {
    this.logs.push({ level, event, ...(fields !== undefined ? { fields } : {}) });
  }
}
