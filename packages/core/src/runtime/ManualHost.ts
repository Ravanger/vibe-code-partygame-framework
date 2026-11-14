import { AudienceScopes } from "../audienceScopes.js";
import { TimerQueue } from "../timers.js";
import { type Seed, seedFromNumber, sfc32 } from "../utils.js";
import type { PlayerInfo, TimerHandle } from "./types.js";

/**
 * The host machinery shared by the manual-clock hosts (the test and replay hosts): a deterministic
 * clock with a timer queue, seats (the first is host), a seeded room rng and audience once-scopes.
 * Subclasses add their client-traffic behaviour (recording or dropping) and their own `advance`
 * limits. Internal: not part of the package's public surface.
 */
export abstract class ManualHost {
  readonly seats: PlayerInfo[] = [];
  time = 1_000_000;
  /** The room RNG seed; an unseeded host is `seedFromNumber(0)`, a deterministic stream. */
  readonly seed: Seed;
  private rngFn: () => number;
  protected readonly queue = new TimerQueue();
  private nextId = 1;
  protected readonly audienceScopes = new AudienceScopes();

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

  /** {@inheritDoc RuntimeHost.players} */
  players(): PlayerInfo[] {
    return this.seats;
  }

  /** {@inheritDoc RuntimeHost.activateWaitingPlayers} */
  activateWaitingPlayers(): void {
    for (const seat of this.seats) if (seat.isReady) seat.isActive = true;
  }

  /** {@inheritDoc RuntimeHost.benchUnreadyPlayers} */
  benchUnreadyPlayers(): void {
    for (const seat of this.seats) if (!seat.isReady) seat.isActive = false;
  }

  /** {@inheritDoc RuntimeHost.kick} */
  kick(playerId: string): void {
    const index = this.seats.findIndex((s) => s.id === playerId);
    if (index >= 0) this.seats.splice(index, 1);
  }

  /** {@inheritDoc RuntimeHost.notifyTransition} */
  notifyTransition(_from: string, _to: string): void {
    this.audienceScopes.clear();
  }

  /** {@inheritDoc RuntimeHost.audienceOnce} */
  audienceOnce(audienceKey: string, scope: string): boolean {
    return this.audienceScopes.once(audienceKey, scope);
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
    this.queue.push({ id, at: this.time + ms, callback });
    return id as TimerHandle;
  }

  /** {@inheritDoc RuntimeHost.clearTimeout} */
  clearTimeout(handle: TimerHandle): void {
    this.queue.remove((t) => t.id === handle);
  }
}
