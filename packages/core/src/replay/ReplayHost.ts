import type { PlayerInfo, RuntimeHost, TimerHandle } from "../runtime/types.js";
import { type Seed, seedFromNumber, sfc32 } from "../utils.js";

interface Timer {
  id: number;
  at: number;
  callback: () => void;
}

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
  private timers: Timer[] = [];
  private nextId = 1;
  /** Scopes each audience key has already used; cleared on every transition, like the live host. */
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

  /** Advances the clock to `time + ms`, firing every due timer in order. */
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.timers
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.callback();
    }
    this.time = target;
  }

  /** {@inheritDoc RuntimeHost.players} */
  players(): PlayerInfo[] {
    return this.seats;
  }

  activateWaitingPlayers(): void {
    for (const seat of this.seats) if (seat.isReady) seat.isActive = true;
  }

  benchUnreadyPlayers(): void {
    for (const seat of this.seats) if (!seat.isReady) seat.isActive = false;
  }

  /** {@inheritDoc RuntimeHost.send} */
  send(_playerId: string, _type: string, _payload: unknown): void {}

  /** {@inheritDoc RuntimeHost.broadcast} */
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

  /** {@inheritDoc RuntimeHost.showTo} */
  showTo(_playerId: string, _ref: object): void {}

  /** {@inheritDoc RuntimeHost.hideFrom} */
  hideFrom(_playerId: string, _ref: object): void {}

  kick(playerId: string): void {
    const index = this.seats.findIndex((s) => s.id === playerId);
    if (index >= 0) this.seats.splice(index, 1);
  }

  publishOptions(_options: unknown): void {}

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
    this.timers.push({ id, at: this.time + ms, callback });
    return id as TimerHandle;
  }

  /** {@inheritDoc RuntimeHost.clearTimeout} */
  clearTimeout(handle: TimerHandle): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }
}
