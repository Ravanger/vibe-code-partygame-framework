import { type Client, type Delayed, logger, Room, ServerError } from "@colyseus/core";
import { type Schema, StateView } from "@colyseus/schema";
import type { FilterLevel, TextFilter } from "@partygame/content/filter";
import {
  type GameDefinition,
  GameRuntime,
  type PlayerInfo,
  type RuntimeHost,
  randomSeed,
  type Seed,
  sfc32,
} from "@partygame/core";
import {
  type ActionResult,
  CLIENT_MESSAGES,
  CLOSE_CODES,
  ClientMessage,
  type CloseCode,
  ErrorCode,
  JoinOptionsSchema,
  LOBBY_PHASE,
  MAX_OPTIONS_JSON_LENGTH,
  type ServerError as ProtocolError,
  RoomOptionsSchema,
  ServerMessage,
  SetNameSchema,
} from "@partygame/shared";
import type { BaseGameState } from "@partygame/shared/schema";
import { PlayerSchema } from "@partygame/shared/schema";
import type { ZodError } from "zod";
import type { RoomCodeService } from "../services/RoomCodeService.js";

const SPECTATOR_SLOTS = 32;
const FRAMEWORK_KEYS = ["playerId", "name", "spectator", "seats"];
const SPECTATOR_ERROR: ProtocolError = {
  code: ErrorCode.UNAUTHORIZED,
  message: CLIENT_MESSAGES.UNAUTHORIZED,
};
const ACTION_FAILED: ActionResult = {
  ok: false,
  error: { code: ErrorCode.INTERNAL, message: CLIENT_MESSAGES.INTERNAL },
};

export interface GameRoomConfig {
  definition: GameDefinition<BaseGameState, unknown, unknown>;
  stateClass: new () => BaseGameState;
  roomCodeService: RoomCodeService;
  reconnectMs: number;
  emptyRoomGraceMs: number;
  /** When set, player names are checked against it at join and on `SET_NAME`. */
  textFilter?: TextFilter;
}

/** Generic Colyseus room: seats, roster, reconnection and per-player views around a core `GameRuntime`. */
export class GameRoom extends Room<{ state: BaseGameState }> {
  private runtime!: GameRuntime<BaseGameState, unknown, unknown>;
  private emptyTimer: Delayed | undefined;
  private readonly playerOf = new Map<string, string>();
  private readonly spectators = new Set<string>();
  private readonly kicked = new Set<string>();
  private seatList: Set<string> | undefined;
  private readonly views = new Map<string, StateView>();
  private readonly viewRefs = new Map<string, Set<Schema>>();
  /** The room's current parsed options; the host's `publishOptions` is its single writer. */
  private roomOptions: Record<string, unknown> = {};
  /** Per-room RNG seed drawn from the platform CSPRNG at room creation; recorded in action logs. */
  private readonly seed: Seed = randomSeed();
  /** Seeded PRNG so a room's randomness is reproducible from its log header. */
  private readonly rngFn = sfc32(this.seed);
  /** Builds the Colyseus close `ServerError` for a {@link CLOSE_CODES} entry; the only place one is made. */
  private readonly closeWith = (entry: CloseCode): ServerError =>
    new ServerError(entry.code, entry.message);

  constructor(private readonly config: GameRoomConfig) {
    super();
  }

  onCreate(options: Record<string, unknown>): void {
    try {
      this.create(options);
    } catch (error) {
      throw this.unexpected("create", error);
    }
  }

  onJoin(client: Client, options?: unknown): void {
    try {
      this.join(client, options);
    } catch (error) {
      throw this.unexpected("join", error);
    }
  }

  /** Close codes thrown by `closeWith` pass through; anything else is logged and becomes the fixed INTERNAL close. */
  private unexpected(phase: string, error: unknown): ServerError {
    if (error instanceof ServerError) return error;
    logger.error(`[GameRoom] ${phase} failed`, error);
    return this.closeWith(CLOSE_CODES.INTERNAL);
  }

  private invalidOptions(where: string, error: ZodError): ServerError {
    logger.warn(`[GameRoom] invalid ${where} options`, error.issues);
    return this.closeWith(CLOSE_CODES.INVALID_OPTIONS);
  }

  private create(options: Record<string, unknown>): void {
    const { definition, stateClass, roomCodeService } = this.config;
    const roomOptions = RoomOptionsSchema.safeParse(options);
    if (!roomOptions.success) throw this.invalidOptions("create", roomOptions.error);
    if (roomOptions.data.seats) {
      if (roomOptions.data.seats.length > definition.maxPlayers) {
        throw this.closeWith(CLOSE_CODES.INVALID_OPTIONS);
      }
      this.seatList = new Set(roomOptions.data.seats);
    }
    this.autoDispose = false;
    this.maxClients = definition.maxPlayers + SPECTATOR_SLOTS;
    const rawOptions = Object.fromEntries(
      Object.entries(options).filter(([key]) => !FRAMEWORK_KEYS.includes(key)),
    );
    if (!definition.options && Object.keys(rawOptions).length > 0) {
      throw this.closeWith(CLOSE_CODES.INVALID_OPTIONS);
    }
    const optionsResult = definition.options?.safeParse(rawOptions);
    if (optionsResult && !optionsResult.success) {
      throw this.invalidOptions("create", optionsResult.error);
    }
    const parsedOptions = optionsResult ? optionsResult.data : rawOptions;
    if (JSON.stringify(parsedOptions).length > MAX_OPTIONS_JSON_LENGTH) {
      throw this.closeWith(CLOSE_CODES.INVALID_OPTIONS);
    }

    const code = roomCodeService.generateAndRegister(this.roomId);

    try {
      const state = new stateClass();
      state.minPlayers = definition.minPlayers;
      state.maxPlayers = definition.maxPlayers;
      state.serverNow = Date.now();
      state.roomCode = code;
      this.setState(state);
      this.host.publishOptions(parsedOptions);
      this.runtime = new GameRuntime({
        definition,
        state,
        options: parsedOptions,
        host: this.host,
      });
      this.clock.setInterval(() => {
        state.serverNow = Date.now();
      }, 1000);
      this.scheduleDisposeIfEmpty();

      this.onMessage(ClientMessage.SET_NAME, (client, raw: unknown) => this.setName(client, raw));
      this.onMessage(ClientMessage.ACTION, (client, raw: unknown): ActionResult => {
        const seat = this.seatOf(client);
        return seat ? this.act(seat.id, raw) : { ok: false, error: SPECTATOR_ERROR };
      });
    } catch (error) {
      roomCodeService.unregister(code);
      throw error;
    }
  }

  private join(client: Client, options?: unknown): void {
    const parsed = JoinOptionsSchema.safeParse(options);
    if (!parsed.success) throw this.invalidOptions("join", parsed.error);
    const { playerId, name, spectator } = parsed.data;
    if (this.kicked.has(playerId)) throw this.closeWith(CLOSE_CODES.KICKED_REJOIN);
    if (!spectator && this.seatList && !this.seatList.has(playerId)) {
      throw this.closeWith(CLOSE_CODES.WATCH_ONLY);
    }
    const view = new StateView();
    client.view = view;
    this.views.set(client.sessionId, view);
    if (spectator) {
      this.spectators.add(client.sessionId);
      ++this.state.spectatorCount;
      return;
    }
    this.cancelDispose();
    const existing = this.state.players.get(playerId);
    if (existing) {
      this.bind(playerId, client.sessionId);
      this.reconnected(existing, client);
      return;
    }
    if (this.state.players.size >= this.config.definition.maxPlayers) {
      throw this.closeWith(CLOSE_CODES.ROOM_FULL);
    }
    if (name && this.nameRejected(name) !== undefined) {
      throw this.closeWith(CLOSE_CODES.CONTENT_REJECTED);
    }
    const seat = new PlayerSchema();
    seat.id = playerId;
    seat.name = name && !this.nameTaken(playerId, name) ? name : "";
    seat.isActive = this.state.phase === LOBBY_PHASE;
    this.state.players.set(playerId, seat);
    this.bind(playerId, client.sessionId);
    this.rosterChanged();
  }

  async onDrop(client: Client): Promise<void> {
    const seat = this.seatBySession(client);
    if (!seat) return;
    seat.isConnected = false;
    this.rosterChanged();
    this.scheduleDisposeIfEmpty();
    await this.allowReconnection(client, this.config.reconnectMs / 1000).catch(() => undefined);
  }

  onReconnect(client: Client): void {
    const seat = this.seatBySession(client);
    if (!seat) throw this.closeWith(CLOSE_CODES.SEAT_REMOVED);
    this.cancelDispose();
    this.reconnected(seat, client);
  }

  onLeave(client: Client): void {
    this.views.delete(client.sessionId);
    if (this.spectators.delete(client.sessionId)) {
      --this.state.spectatorCount;
      return;
    }
    const seat = this.seatBySession(client);
    if (seat) this.removeSeat(seat.id);
  }

  onDispose(): void {
    this.runtime?.stop();
    if (this.state?.roomCode) this.config.roomCodeService.unregister(this.state.roomCode);
  }

  private readonly host: RuntimeHost = {
    players: () => [...this.state.players.values()].map((seat) => this.infoOf(seat)),
    activateWaitingPlayers: () => {
      for (const seat of this.state.players.values()) if (seat.isReady) seat.isActive = true;
    },
    benchUnreadyPlayers: () => {
      for (const seat of this.state.players.values()) if (!seat.isReady) seat.isActive = false;
    },
    send: (playerId, type, payload) => this.clientFor(playerId)?.send(type, payload),
    broadcast: (type, payload) => this.broadcast(type, payload),
    showTo: (playerId, ref: Schema) => {
      const refs = this.viewRefs.get(playerId) ?? new Set<Schema>();
      this.viewRefs.set(playerId, refs.add(ref));
      this.viewFor(playerId)?.add(ref);
    },
    hideFrom: (playerId, ref: Schema) => {
      this.viewRefs.get(playerId)?.delete(ref);
      this.viewFor(playerId)?.remove(ref);
    },
    kick: (playerId) => {
      this.kicked.add(playerId);
      const client = this.clientFor(playerId);
      client?.send(ServerMessage.ERROR, {
        code: ErrorCode.KICKED,
        message: CLIENT_MESSAGES.KICKED,
      });
      this.dropSeat(playerId);
      this.scheduleDisposeIfEmpty();
      client?.leave();
    },
    publishOptions: (options) => {
      this.roomOptions = options as Record<string, unknown>;
      this.state.options = JSON.stringify(options);
    },
    now: () => Date.now(),
    rng: () => this.rngFn(),
    seed: this.seed,
    setTimeout: (callback, ms) => this.clock.setTimeout(() => this.safely(callback), ms),
    clearTimeout: (handle: Delayed) => handle.clear(),
  };

  private setName(client: Client, raw: unknown): void {
    const seat = this.seatOf(client);
    if (!seat) return;
    const name = SetNameSchema.safeParse(raw);
    if (!name.success) {
      client.send(ServerMessage.ERROR, {
        code: ErrorCode.INVALID_ACTION,
        message: CLIENT_MESSAGES.INVALID_ACTION,
      });
      return;
    }
    const reason = this.nameRejected(name.data);
    if (reason !== undefined) {
      client.send(ServerMessage.ERROR, { code: ErrorCode.CONTENT_REJECTED, message: reason });
      return;
    }
    if (this.nameTaken(seat.id, name.data)) {
      client.send(ServerMessage.ERROR, {
        code: ErrorCode.NAME_TAKEN,
        message: CLIENT_MESSAGES.NAME_TAKEN,
      });
      return;
    }
    seat.name = name.data;
    seat.isReady = true;
    if (this.state.phase === LOBBY_PHASE) seat.isActive = true;
    this.rosterChanged();
  }

  /** The room's current text-filter level: the definition's `filterLevel` over the live options, default `"off"`. */
  private filterLevel(): FilterLevel {
    return this.config.definition.filterLevel?.(this.roomOptions) ?? "off";
  }

  /** The filter's reason when `name` fails at the room's current level; `undefined` when it passes or no filter is set. */
  private nameRejected(name: string): string | undefined {
    const filter = this.config.textFilter;
    if (!filter) return undefined;
    const result = filter.check(name, this.filterLevel());
    return result.ok ? undefined : result.reason;
  }

  private nameTaken(playerId: string, name: string): boolean {
    const wanted = name.trim().toLowerCase();
    return [...this.state.players.values()].some(
      (seat) => seat.id !== playerId && seat.name.trim().toLowerCase() === wanted,
    );
  }

  private seatBySession(client: Client): PlayerSchema | undefined {
    return this.state.players.get(this.playerOf.get(client.sessionId) ?? "");
  }

  private seatOf(client: Client): PlayerSchema | undefined {
    const seat = this.seatBySession(client);
    if (!seat) client.send(ServerMessage.ERROR, SPECTATOR_ERROR);
    return seat;
  }

  private act(playerId: string, raw: unknown): ActionResult {
    try {
      const error = this.runtime.dispatch(playerId, raw);
      return error ? { ok: false, error } : { ok: true };
    } catch (error) {
      logger.error("[GameRoom] action failed", error);
      return ACTION_FAILED;
    }
  }

  private clientFor(playerId: string): Client | undefined {
    return this.clients.find((client) => this.playerOf.get(client.sessionId) === playerId);
  }

  private viewFor(playerId: string): StateView | undefined {
    const client = this.clientFor(playerId);
    return client && this.views.get(client.sessionId);
  }

  private infoOf(seat: PlayerSchema): PlayerInfo {
    return {
      id: seat.id,
      name: seat.name,
      role: seat.role,
      isConnected: seat.isConnected,
      isReady: seat.isReady,
      isActive: seat.isActive,
    };
  }

  private bind(playerId: string, sessionId: string): void {
    this.unbind(playerId);
    this.playerOf.set(sessionId, playerId);
  }

  private reconnected(seat: PlayerSchema, client: Client): void {
    seat.isConnected = true;
    const view = this.views.get(client.sessionId);
    for (const ref of this.viewRefs.get(seat.id) ?? []) view?.add(ref);
    this.safely(() => this.runtime.syncPlayer(seat.id));
    this.rosterChanged();
  }

  private dropSeat(playerId: string): void {
    this.state.players.delete(playerId);
    this.viewRefs.delete(playerId);
    this.unbind(playerId);
  }

  private unbind(playerId: string): void {
    for (const [sessionId, id] of this.playerOf)
      if (id === playerId) this.playerOf.delete(sessionId);
  }

  private removeSeat(playerId: string): void {
    this.dropSeat(playerId);
    this.rosterChanged();
    this.scheduleDisposeIfEmpty();
  }

  private rosterChanged(): void {
    const seats = [...this.state.players.values()];
    const host = seats.find((seat) => seat.role === "host");
    if (!host?.isConnected) {
      const next = this.nextHost(seats);
      if (next) {
        if (host) host.role = "player";
        next.role = "host";
      }
    }
    this.safely(() => this.runtime.rosterChanged());
  }

  private nextHost(seats: PlayerSchema[]): PlayerSchema | undefined {
    const connected = seats.filter((seat) => seat.isConnected);
    return (
      connected.find((seat) => seat.isActive && seat.isReady) ??
      connected.find((seat) => seat.isReady) ??
      connected[0]
    );
  }

  private scheduleDisposeIfEmpty(): void {
    const occupied = [...this.state.players.values()].some((seat) => seat.isConnected);
    if (occupied || this.emptyTimer) return;
    this.emptyTimer = this.clock.setTimeout(
      () => void this.disconnect(),
      this.config.emptyRoomGraceMs,
    );
  }

  private cancelDispose(): void {
    this.emptyTimer?.clear();
    this.emptyTimer = undefined;
  }

  private safely(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      logger.error("[GameRoom] hook failed", error);
    }
  }
}
