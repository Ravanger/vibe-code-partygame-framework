import { Client } from "@colyseus/sdk";
import { RoomCodeError, resolveRoomCode } from "@partygame/client-utils";
import {
  type ActionResult,
  CLOSE_CODES,
  ClientMessage,
  closeCodeEntry,
  ErrorCode,
  type ExportReplayResponse,
  isActionResult,
  isServerError,
  PROTOCOL_VERSION,
  RoomCodeSchema,
  type ServerError,
  ServerMessage,
} from "@partygame/shared";
import type { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { createSubscriber } from "svelte/reactivity";
import { Countdown } from "./countdown.svelte.js";
import { CANCELLED, JoinCoordinator } from "./JoinCoordinator.js";
import { MessageBus } from "./MessageBus.js";
import { PersistedSession } from "./PersistedSession.js";
import type { RoomLike } from "./RoomLike.js";
import { type ClientStrings, defaultClientStrings, resolveClientMessages } from "./strings.js";

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
  /** Receives the exception behind a local action failure, never shown to the UI. Default `console.warn`. */
  logger?: (message: string, error: unknown) => void;
  /** Replaces the manager's client-owned messages; unspecified keys keep the English defaults. */
  strings?: Partial<ClientStrings>;
}

/** Options for {@link GameConnectionManager.join}; the manager adds `playerId`, `seatSecret` and `protocolVersion` itself. */
export interface JoinOptions {
  /** The name to join with; validated like `SET_NAME`. */
  name?: string;
  /** Join without a seat, as a TV display does. */
  spectator?: boolean;
  /** Bounded data for the game's `canJoin` hook (an invite code or password); sent once per join, never stored or logged. */
  joinData?: Record<string, string | number | boolean>;
}

const DEFAULT_API_PORT = 3001;
const DEFAULT_SYNC_TIMEOUT_MS = 10_000;

/**
 * Connection to one game room: lifecycle, the reactive state, and the player's actions.
 * `TEvents` maps message names to payload types for typed `onMessage`; by default any name is accepted with an `unknown` payload.
 */
export class GameConnectionManager<
  TState extends BaseGameState = BaseGameState,
  TEvents extends Record<string, unknown> = Record<string, unknown>,
> {
  status: ConnectionStatus = $state("idle");
  lastServerError: ServerError | undefined = $state.raw(undefined);
  readonly playerId: string;

  private room: RoomLike<TState> | undefined = $state.raw(undefined);
  private readonly client: Client;
  private readonly session: PersistedSession;
  private readonly apiBase: string;
  private readonly strings: ClientStrings;
  private readonly messages: Record<ErrorCode, string>;
  private readonly bus = new MessageBus<TState>();
  private readonly coordinator = new JoinCoordinator();
  private spectating = false;
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
    this.strings = { ...defaultClientStrings, ...options.strings };
    this.messages = resolveClientMessages(this.strings);
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
    await this.coordinator.run("create", (cancelled) =>
      this.open(
        () =>
          this.client.create<TState>(
            this.options.roomName,
            {
              ...options,
              playerId: this.playerId,
              seatSecret: this.session.seatSecret,
              protocolVersion: PROTOCOL_VERSION,
            },
            this.options.rootSchema,
          ),
        false,
        cancelled,
      ),
    );
  }

  /** Joins the room for `code` by its code; throws with the server's reason. */
  async join(code: string, options: JoinOptions = {}): Promise<void> {
    const clean = code.trim().toUpperCase();
    if (!RoomCodeSchema.safeParse(clean).success) {
      throw new Error(this.strings.invalidRoomCode);
    }
    const spectator = options.spectator === true;
    if (this.room && this.roomCode === clean && this.spectating === spectator) return;
    await this.coordinator.run(`${clean}:${spectator ? "tv" : "player"}`, (cancelled) =>
      this.open(
        async () =>
          this.client.joinById<TState>(
            await resolveRoomCode(this.apiBase, clean),
            {
              ...options,
              playerId: this.playerId,
              seatSecret: this.session.seatSecret,
              protocolVersion: PROTOCOL_VERSION,
            },
            this.options.rootSchema,
          ),
        spectator,
        cancelled,
      ),
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
        this.coordinator.run("resume", (cancelled) =>
          this.open(
            () => this.client.reconnect<TState>(token, this.options.rootSchema),
            false,
            cancelled,
          ),
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
    this.coordinator.cancel();
    await this.closeRoom();
  }

  setName(name: string): void {
    this.room?.send(ClientMessage.SET_NAME, name);
  }

  /**
   * Sends a game action and resolves with the server's verdict. Failures are also kept in
   * `lastServerError`. The payload may not carry a `type` field (reserved for the action name);
   * such a call fails locally with `INVALID_ACTION` without sending.
   */
  async sendAction(type: string, payload: object = {}): Promise<ActionResult> {
    if (!this.room) return this.fail(ErrorCode.NOT_CONNECTED);
    // `type` is reserved for the action name; a payload field by that name would be silently replaced.
    if ("type" in payload) return this.fail(ErrorCode.INVALID_ACTION);
    try {
      const result = await this.room.request(ClientMessage.ACTION, { ...payload, type });
      if (!isActionResult(result)) return this.fail(ErrorCode.BAD_REPLY);
      if (!result.ok) this.setLastError(result.error);
      return result;
    } catch (error) {
      (this.options.logger ?? console.warn)(
        `[GameConnectionManager] ${type} request failed`,
        error,
      );
      return this.fail(ErrorCode.CONNECTION_LOST);
    }
  }

  /**
   * The host's request for this room's replay bundle (the answer to `ClientMessage.EXPORT_REPLAY`).
   * A non-host gets the server's `UNAUTHORIZED` refusal, passed through and remembered in
   * {@link lastServerError}; a well-formed bundle resolves as-is. The success side is validated
   * too: a reply without both a number `bundleVersion` and an array `snapshots` fails with
   * `BAD_REPLY`.
   */
  async exportReplay(): Promise<ExportReplayResponse> {
    if (!this.room) return this.fail(ErrorCode.NOT_CONNECTED);
    try {
      const response = await this.room.request(ClientMessage.EXPORT_REPLAY);
      if (response === null || typeof response !== "object" || Array.isArray(response)) {
        return this.fail(ErrorCode.BAD_REPLY);
      }
      const reply = response as Record<string, unknown>;
      if (reply.ok === false) {
        if (!isServerError(reply.error)) return this.fail(ErrorCode.BAD_REPLY);
        this.setLastError(reply.error);
        return { ok: false, error: reply.error };
      }
      if (typeof reply.bundleVersion !== "number" || !Array.isArray(reply.snapshots)) {
        return this.fail(ErrorCode.BAD_REPLY);
      }
      return reply;
    } catch (error) {
      (this.options.logger ?? console.warn)(
        `[GameConnectionManager] EXPORT_REPLAY request failed`,
        error,
      );
      return this.fail(ErrorCode.CONNECTION_LOST);
    }
  }

  /** Listens for a pushed message type; survives room changes. Register before connecting so the SDK does not warn. */
  onMessage<K extends keyof TEvents & string>(
    type: K,
    callback: (payload: TEvents[K]) => void,
  ): () => void {
    // The bus stores untyped callbacks; the typed contract lives at this public boundary.
    return this.bus.on(type, callback as (payload: unknown) => void);
  }

  dismissError(): void {
    this.setLastError(undefined);
  }

  /** Adopts an already-connected room. `create`/`join`/`resume` end here; tests may call it with a `StubRoom`. */
  attach(room: RoomLike<TState>): void {
    this.detach();
    this.room = room;
    this.bindState();
    this.bus.bind(room);
    room.onDrop(() => this.whileAttached(room, () => (this.status = "reconnecting")));
    room.onReconnect(() =>
      this.whileAttached(room, () => {
        this.status = "connected";
        this.rememberToken(room);
      }),
    );
    room.onLeave((code) =>
      this.whileAttached(room, () => {
        this.session.clear();
        this.spectating = false;
        this.recordClose(code);
        this.detach("disconnected");
      }),
    );
    this.status = "connected";
    this.rememberToken(room);
    this.rememberRoomCode(room);
  }

  /** Leaves the room without forgetting the session and stops all listeners. */
  dispose(): void {
    this.coordinator.cancel();
    const room = this.room;
    this.detach("disconnected");
    this.bus.clear();
    if (room) this.leaveQuietly(room, false);
  }

  private async open(
    openRoom: () => Promise<RoomLike<TState>>,
    spectator: boolean,
    cancelled: () => boolean,
  ): Promise<void> {
    if (this.room) await this.closeRoom();
    if (cancelled()) throw new Error(CANCELLED);
    this.status = "connecting";
    try {
      const room = await openRoom();
      if (!cancelled()) await this.untilSynced(room);
      if (cancelled()) {
        this.leaveQuietly(room);
        throw new Error(CANCELLED);
      }
      this.spectating = spectator;
      this.attach(room);
    } catch (error) {
      if (!cancelled()) this.status = "disconnected";
      this.recordRejection(error, !cancelled());
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
        room.onLeave.remove(onLeave);
      };
      const check = (): void => {
        if (settled || !room.state?.roomCode) return;
        settle();
        resolve();
      };
      // `settle` removes this listener, so it can only fire while the wait is still open.
      const onLeave = (): void => {
        settle();
        reject(new Error("Disconnected before the game state arrived"));
      };
      const timer = setTimeout(() => {
        settle();
        this.leaveQuietly(room);
        reject(new Error("Timed out waiting for the game state"));
      }, this.options.syncTimeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS);
      room.onStateChange(check);
      room.onLeave(onLeave);
      check();
    });
  }

  /** Leaves a room without letting a failing `leave()` escape as an unhandled rejection. */
  private leaveQuietly(room: RoomLike<TState>, consented = true): void {
    void room.leave(consented).catch(() => undefined);
  }

  private async closeRoom(): Promise<void> {
    const room = this.room;
    this.session.clear();
    this.spectating = false;
    this.detach("disconnected");
    await room?.leave(true);
  }

  private detach(status?: ConnectionStatus): void {
    this.unbindState();
    this.bus.unbind();
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
    if (isServerError(payload)) this.setLastError(payload);
  }

  /**
   * The single writer for `lastServerError`: server ERROR payloads, failed actions, close codes and
   * `dismissError()` (undefined) all land here. When the strings table has an entry for the code, it
   * replaces the message.
   */
  private setLastError(error: ServerError | undefined): void {
    if (error === undefined) {
      this.lastServerError = error;
      return;
    }
    const text = this.strings.errors?.[error.code];
    this.lastServerError = text === undefined ? error : { ...error, message: text };
  }

  /** Records a numeric close code when it is in CLOSE_CODES; unknown codes leave `lastServerError` untouched. */
  private recordClose(code: number): void {
    const entry = closeCodeEntry(code);
    if (entry) this.setLastError({ code: entry.errorCode, message: entry.message });
  }

  /**
   * Records why a connect failed, as a fixed message: a known close code, an unknown room code, a bad
   * resolve-code reply, else CONNECTION_LOST. The exception goes to the logger; a stale (cancelled) connect records nothing new.
   */
  private recordRejection(error: unknown, current: boolean): void {
    if (error instanceof RoomCodeError) {
      this.fail(error.reason === "not-found" ? ErrorCode.ROOM_NOT_FOUND : ErrorCode.BAD_REPLY);
      return;
    }
    const closeError = this.closeErrorOf(error);
    if (closeError) {
      this.setLastError(closeError);
      return;
    }
    if (!current) return;
    (this.options.logger ?? console.warn)("[GameConnectionManager] connect failed", error);
    this.fail(ErrorCode.CONNECTION_LOST);
  }

  /**
   * The client-visible error for a refused connection: the table's fixed message, except
   * VERSION_MISMATCH (whose template the server fills with both versions) and a 4403 canJoin refusal
   * (which carries the game's own message); both pass the received text through.
   */
  private closeErrorOf(error: unknown): ServerError | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
    const code = error.code;
    if (typeof code !== "number") return undefined;
    const entry = closeCodeEntry(code);
    if (!entry) return undefined;
    // VERSION_MISMATCH's template and a 4403 canJoin refusal carry server-filled text; show what arrived.
    if (
      (entry === CLOSE_CODES.VERSION_MISMATCH || code === CLOSE_CODES.JOIN_REFUSED.code) &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return { code: entry.errorCode, message: error.message };
    }
    return { code: entry.errorCode, message: entry.message };
  }

  /** A client-side action failure: the strings table's message for `code`, never the raw exception text. */
  private fail(code: ErrorCode): ActionResult {
    const error: ServerError = { code, message: this.messages[code] };
    this.setLastError(error);
    return { ok: false, error };
  }
}
