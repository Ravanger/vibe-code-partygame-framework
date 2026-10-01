import { Client } from "@colyseus/sdk";
import {
  type ActionResult,
  ClientMessage,
  ErrorCode,
  isActionResult,
  isServerError,
  ResolveCodeResponseSchema,
  RoomCodeSchema,
  type ServerError,
  ServerMessage,
} from "@partygame/shared";
import type { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { createSubscriber } from "svelte/reactivity";
import { Countdown } from "./countdown.svelte.js";
import { PersistedSession } from "./PersistedSession.js";
import type { RoomLike } from "./RoomLike.js";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface GameConnectionOptions<TState> {
  /** Game server URL, e.g. `http://host:2567`. */
  endpoint: string;
  /** Name the game was registered under on the server. */
  roomName: string;
  /** Port of the `/api/resolve-code` API on the same host. Default 3001. */
  apiPort?: number;
  /** Namespaces the browser storage keys, so several games (or several test clients) never share a session. */
  storagePrefix: string;
  /** The game's state class; without it the client decodes the state from the server's reflection. */
  rootSchema?: new () => TState;
  /** How long to wait for the room's first state before giving up. Default 10000 ms. */
  syncTimeoutMs?: number;
}

interface Listener {
  type: string;
  callback: (payload: unknown) => void;
  off: (() => void) | undefined;
}

const DEFAULT_API_PORT = 3001;
const DEFAULT_SYNC_TIMEOUT_MS = 10_000;
const CANCELLED = "Connection cancelled";

/** Connection to one game room: lifecycle, the reactive state, and the player's actions. */
export class GameConnectionManager<TState extends BaseGameState = BaseGameState> {
  status: ConnectionStatus = $state("idle");
  lastServerError: ServerError | undefined = $state.raw(undefined);
  readonly playerId: string;

  private room: RoomLike<TState> | undefined = $state.raw(undefined);
  private readonly client: Client;
  private readonly session: PersistedSession;
  private readonly apiBase: string;
  private readonly listeners = new Set<Listener>();
  private pending: { key: string; promise: Promise<void> } | undefined;
  private spectating = false;
  private generation = 0;
  private notify: (() => void) | undefined;
  private bound: { room: RoomLike<TState>; callback: () => void } | undefined;
  private readonly track = createSubscriber((update) => {
    this.notify = update;
    this.bindState();
    return () => {
      this.unbindState();
      this.notify = undefined;
    };
  });

  constructor(private readonly options: GameConnectionOptions<TState>) {
    this.client = new Client(options.endpoint);
    this.session = new PersistedSession(options.storagePrefix);
    this.playerId = this.session.playerId;
    const url = new URL(options.endpoint);
    const port = options.apiPort ?? DEFAULT_API_PORT;
    this.apiBase = `${url.protocol.replace("ws", "http")}//${url.hostname}:${port}`;
    this.onMessage(ServerMessage.ERROR, (payload) => this.serverErrorReceived(payload));
  }

  /** The room's state, or `undefined` while not in a room. Reading it inside `$derived`/`$effect`/templates re-runs on every patch. */
  get state(): TState | undefined {
    this.track();
    return this.room?.state;
  }

  get roomCode(): string | undefined {
    return this.state?.roomCode || undefined;
  }

  get isHost(): boolean {
    return this.me()?.role === "host";
  }

  /** True while in a room without a seat, as a TV display is. */
  get isSpectator(): boolean {
    return this.state !== undefined && this.me() === undefined;
  }

  /** This client's seat; `undefined` for a spectator or before the seat is synced. */
  me(): PlayerSchema | undefined {
    return this.state?.players.get(this.playerId);
  }

  /** A ticking countdown to the current phase's `phaseEndsAt`, corrected for client clock skew. Call `destroy()` when done. */
  countdown(): Countdown {
    return new Countdown(
      () => this.state?.phaseEndsAt ?? 0,
      () => this.state?.serverNow ?? 0,
    );
  }

  async create(options: Record<string, unknown> = {}): Promise<void> {
    await this.connect(
      "create",
      () =>
        this.client.create<TState>(
          this.options.roomName,
          { ...options, playerId: this.playerId },
          this.options.rootSchema,
        ),
      false,
    );
  }

  async join(code: string, options: Record<string, unknown> = {}): Promise<void> {
    const clean = code.trim().toUpperCase();
    if (!RoomCodeSchema.safeParse(clean).success) {
      throw new Error("Game code must be 4 letters (A-Z)");
    }
    const spectator = options.spectator === true;
    if (this.room && this.roomCode === clean && this.spectating === spectator) return;
    await this.connect(
      `${clean}:${spectator ? "tv" : "player"}`,
      async () =>
        this.client.joinById<TState>(
          await this.resolveRoomId(clean),
          { ...options, playerId: this.playerId },
          this.options.rootSchema,
        ),
      spectator,
    );
  }

  joinAsSpectator(code: string): Promise<void> {
    return this.join(code, { spectator: true });
  }

  /** Reconnect after a page reload: the stored token first, then the stored room code. A spectator rejoins as a spectator by code. */
  async resume(): Promise<boolean> {
    const token = this.session.token;
    const spectator = this.session.spectator;
    if (
      token &&
      !spectator &&
      (await this.succeeds(() =>
        this.connect(
          "resume",
          () => this.client.reconnect<TState>(token, this.options.rootSchema),
          false,
        ),
      ))
    ) {
      return true;
    }
    const code = this.session.roomCode;
    if (code && (await this.succeeds(() => this.join(code, spectator ? { spectator } : {})))) {
      return true;
    }
    this.session.clear();
    return false;
  }

  private async succeeds(attempt: () => Promise<void>): Promise<boolean> {
    try {
      await attempt();
      return true;
    } catch {
      return false;
    }
  }

  /** Leaves the room and cancels any connect still in flight. */
  async leave(): Promise<void> {
    ++this.generation;
    this.pending = undefined;
    await this.closeRoom();
  }

  setName(name: string): void {
    this.room?.send(ClientMessage.SET_NAME, name);
  }

  /** Sends a game action and resolves with the server's verdict. Failures are also kept in `lastServerError`. */
  async sendAction(type: string, payload: object = {}): Promise<ActionResult> {
    if (!this.room) return this.fail("Not connected");
    try {
      const result = await this.room.request(ClientMessage.ACTION, { ...payload, type });
      if (!isActionResult(result)) return this.fail("Malformed reply from the server");
      if (!result.ok) this.lastServerError = result.error;
      return result;
    } catch (error) {
      return this.fail(error instanceof Error ? error.message : "The request failed");
    }
  }

  /** Listens for a pushed message type; survives room changes. Register before connecting so the SDK does not warn. */
  onMessage(type: string, callback: (payload: unknown) => void): () => void {
    const listener: Listener = { type, callback, off: this.room?.onMessage(type, callback) };
    this.listeners.add(listener);
    return () => {
      listener.off?.();
      this.listeners.delete(listener);
    };
  }

  dismissError(): void {
    this.lastServerError = undefined;
  }

  /** Adopts an already-connected room. `create`/`join`/`resume` end here; tests may call it with a `StubRoom`. */
  attach(room: RoomLike<TState>): void {
    this.detach();
    this.room = room;
    this.bindState();
    for (const listener of this.listeners) {
      listener.off = room.onMessage(listener.type, listener.callback);
    }
    room.onDrop(() => this.whileAttached(room, () => (this.status = "reconnecting")));
    room.onReconnect(() =>
      this.whileAttached(room, () => {
        this.status = "connected";
        this.rememberToken(room);
      }),
    );
    room.onLeave(() =>
      this.whileAttached(room, () => {
        this.session.clear();
        this.spectating = false;
        this.detach("disconnected");
      }),
    );
    this.status = "connected";
    this.rememberToken(room);
    this.rememberRoomCode(room);
  }

  /** Leaves the room without forgetting the session and stops all listeners. */
  dispose(): void {
    ++this.generation;
    this.pending = undefined;
    const room = this.room;
    this.detach("disconnected");
    this.listeners.clear();
    void room?.leave(false);
  }

  private async connect(
    key: string,
    open: () => Promise<RoomLike<TState>>,
    spectator: boolean,
  ): Promise<void> {
    if (this.pending?.key === key) return this.pending.promise;
    const entry = { key, promise: this.open(open, spectator) };
    this.pending = entry;
    try {
      await entry.promise;
    } finally {
      if (this.pending === entry) this.pending = undefined;
    }
  }

  private async open(open: () => Promise<RoomLike<TState>>, spectator: boolean): Promise<void> {
    const generation = ++this.generation;
    if (this.room) await this.closeRoom();
    if (generation !== this.generation) throw new Error(CANCELLED);
    this.status = "connecting";
    try {
      const room = await open();
      if (generation === this.generation) await this.untilSynced(room);
      if (generation !== this.generation) {
        void room.leave();
        throw new Error(CANCELLED);
      }
      this.spectating = spectator;
      this.attach(room);
    } catch (error) {
      if (generation === this.generation) this.status = "disconnected";
      throw error;
    }
  }

  private untilSynced(room: RoomLike<TState>): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (): void => {
        settled = true;
        clearTimeout(timer);
        room.onStateChange.remove(check);
      };
      const check = (): void => {
        if (settled || !room.state?.roomCode) return;
        settle();
        resolve();
      };
      const timer = setTimeout(() => {
        settle();
        void room.leave();
        reject(new Error("Timed out waiting for the game state"));
      }, this.options.syncTimeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS);
      room.onStateChange(check);
      room.onLeave(() => {
        if (settled) return;
        settle();
        reject(new Error("Disconnected before the game state arrived"));
      });
      check();
    });
  }

  private async closeRoom(): Promise<void> {
    const room = this.room;
    this.session.clear();
    this.spectating = false;
    this.detach("disconnected");
    await room?.leave(true);
  }

  private async resolveRoomId(code: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/api/resolve-code?code=${code}`);
    const body = ResolveCodeResponseSchema.safeParse(await response.json());
    if (!body.success) throw new Error("Unexpected reply from the game server");
    if ("roomId" in body.data) return body.data.roomId;
    throw new Error(body.data.error);
  }

  private detach(status?: ConnectionStatus): void {
    this.unbindState();
    for (const listener of this.listeners) {
      listener.off?.();
      listener.off = undefined;
    }
    this.room = undefined;
    if (status) this.status = status;
  }

  private bindState(): void {
    if (!this.notify || !this.room || this.bound) return;
    const callback = () => this.notify?.();
    this.room.onStateChange(callback);
    this.bound = { room: this.room, callback };
  }

  private unbindState(): void {
    this.bound?.room.onStateChange.remove(this.bound.callback);
    this.bound = undefined;
  }

  private whileAttached(room: RoomLike<TState>, action: () => void): void {
    if (this.room === room) action();
  }

  private rememberToken(room: RoomLike<TState>): void {
    if (room.reconnectionToken) this.session.token = room.reconnectionToken;
  }

  private rememberRoomCode(room: RoomLike<TState>): void {
    if (room.state.roomCode) this.session.roomCode = room.state.roomCode;
    this.session.spectator = this.spectating;
  }

  private serverErrorReceived(payload: unknown): void {
    if (isServerError(payload)) this.lastServerError = payload;
  }

  private fail(message: string): ActionResult {
    const error: ServerError = { code: ErrorCode.INTERNAL, message };
    this.lastServerError = error;
    return { ok: false, error };
  }
}
