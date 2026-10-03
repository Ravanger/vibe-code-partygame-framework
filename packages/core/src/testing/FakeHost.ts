import type { PlayerInfo, RuntimeHost } from "../runtime/types.js";

interface Timer {
  id: number;
  at: number;
  callback: () => void;
}

export interface Sent {
  playerId: string;
  type: string;
  payload: unknown;
}

export class FakeHost implements RuntimeHost {
  readonly seats: PlayerInfo[] = [];
  readonly sent: Sent[] = [];
  readonly broadcasts: Array<{ type: string; payload: unknown }> = [];
  time = 1_000_000;
  activations = 0;
  readonly views: Array<{ op: "show" | "hide"; playerId: string; ref: object }> = [];
  readonly kicked: string[] = [];
  readonly published: unknown[] = [];
  /** No seeded PRNG yet: `rng()` is the constant 0.5 and this seed is a placeholder. */
  readonly seed = 0;
  private timers: Timer[] = [];
  private nextId = 1;

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

  get pendingTimers(): number {
    return this.timers.length;
  }

  errorsTo(playerId: string): unknown[] {
    return this.sent
      .filter((s) => s.playerId === playerId && s.type === "ERROR")
      .map((s) => s.payload);
  }

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

  send(playerId: string, type: string, payload: unknown): void {
    this.sent.push({ playerId, type, payload });
  }

  broadcast(type: string, payload: unknown): void {
    this.broadcasts.push({ type, payload });
  }

  showTo(playerId: string, ref: object): void {
    this.views.push({ op: "show", playerId, ref });
  }

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

  now(): number {
    return this.time;
  }

  rng(): number {
    return 0.5;
  }

  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.push({ id, at: this.time + ms, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }
}
