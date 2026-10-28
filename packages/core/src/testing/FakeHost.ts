import type {
  Logger,
  LogLevel,
  LogLine,
  PlayerInfo,
  RuntimeHost,
  TimerHandle,
} from "../runtime/types.js";
import { type Seed, seedFromNumber, sfc32 } from "../utils.js";

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
  readonly transitions: Array<{ from: string; to: string }> = [];
  /** Every line `ctx.log` wrote, in order. */
  readonly logs: LogLine[] = [];
  readonly log: Logger = {
    info: (event, fields) => this.record("info", event, fields),
    warn: (event, fields) => this.record("warn", event, fields),
    error: (event, fields) => this.record("error", event, fields),
  };
  /** The room RNG seed; an unseeded host is `seedFromNumber(0)`, a deterministic stream. */
  readonly seed: Seed;
  private rngFn: () => number;
  private timers: Timer[] = [];
  private nextId = 1;
  /** Scopes each audience key has already used; cleared on every transition. */
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
    return this.rngFn();
  }

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++;
    this.timers.push({ id, at: this.time + ms, callback });
    return id as TimerHandle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }

  private record(level: LogLevel, event: string, fields?: LogLine["fields"]): void {
    this.logs.push({ level, event, ...(fields !== undefined ? { fields } : {}) });
  }
}
