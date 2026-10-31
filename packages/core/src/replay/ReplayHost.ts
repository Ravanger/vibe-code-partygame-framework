import type { PlayerInfo, RuntimeHost, TimerHandle } from "../runtime/types.js";
import {
  MAX_TIMER_FIRES_PER_ADVANCE,
  MAX_TIMER_FIRES_PER_REPLAY,
  TimerLimitError,
  TimerQueue,
} from "../timers.js";
import { type Seed, seedFromNumber, sfc32 } from "../utils.js";

/**
 * A minimal {@link RuntimeHost} for replaying a recorded session: a manual clock, seats and the
 * given seed — no recording or assertion helpers, because a replay observes state snapshots, not
 * messages. Client traffic (send, broadcast, views) is dropped; `kick` only removes the seat;
 * transition notifications clear the audience once-scopes so a re-dispatched `ctx.audience.once`
 * sees the same answers as live.
 */
export class ReplayHost implements RuntimeHost {
  readonly seats: PlayerInfo[] = [];
  time = 1_000_000;
  readonly seed: Seed;
  private rngFn: () => number;
  private queue = new TimerQueue();
  private nextId = 1;
  /** Timer fires this run has performed so far; the whole run is budgeted, not just one advance. */
  private firedTotal = 0;
  /** Scopes each audience key has already used; cleared on every transition, like the live host. */
  private readonly audienceScopes = new Map<string, Set<string>>();

  constructor(seed: Seed | number = 0) {
    this.seed = typeof seed === "number" ? seedFromNumber(seed) : seed;
    this.rngFn = sfc32(this.seed);
  }

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

  /**
   * Advances the clock to `time + ms`, firing every due timer in `(at, id)` order. One advance
   * fires at most {@link MAX_TIMER_FIRES_PER_ADVANCE} timers and a whole run at most
   * {@link MAX_TIMER_FIRES_PER_REPLAY}; exceeding either throws a `replayLog:`-prefixed
   * {@link TimerLimitError}, so a hostile log's huge time gaps cannot do unbounded work.
   */
  advance(ms: number): void {
    const target = this.time + ms;
    let fired = 0;
    for (;;) {
      const head = this.queue.peek();
      if (head === undefined || head.at > target) break;
      ++fired;
      if (fired > MAX_TIMER_FIRES_PER_ADVANCE) {
        throw new TimerLimitError(
          `replayLog: this advance would fire more than ${MAX_TIMER_FIRES_PER_ADVANCE} timers; the log's time gaps are too large to replay`,
        );
      }
      if (this.firedTotal + fired > MAX_TIMER_FIRES_PER_REPLAY) {
        throw new TimerLimitError(
          `replayLog: this run would fire more than ${MAX_TIMER_FIRES_PER_REPLAY} timers in total; the log is too long to replay`,
        );
      }
      this.queue.shift();
      this.time = head.at;
      head.callback();
    }
    this.firedTotal += fired;
    this.time = target;
  }

  players(): PlayerInfo[] {
    return this.seats;
  }

  activateWaitingPlayers(): void {
    for (const seat of this.seats) if (seat.isReady) seat.isActive = true;
  }

  benchUnreadyPlayers(): void {
    for (const seat of this.seats) if (!seat.isReady) seat.isActive = false;
  }

  send(_playerId: string, _type: string, _payload: unknown): void {}

  broadcast(_type: string, _payload: unknown): void {}

  notifyTransition(_from: string, _to: string): void {
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

  showTo(_playerId: string, _ref: object): void {}

  hideFrom(_playerId: string, _ref: object): void {}

  kick(playerId: string): void {
    const index = this.seats.findIndex((s) => s.id === playerId);
    if (index >= 0) this.seats.splice(index, 1);
  }

  publishOptions(_options: unknown): void {}

  now(): number {
    return this.time;
  }

  rng(): number {
    return this.rngFn();
  }

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.queue.push({ id, at: this.time + ms, callback });
    return id as TimerHandle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.queue.remove((t) => t.id === handle);
  }
}
