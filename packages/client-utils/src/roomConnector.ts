import type { BaseGameState } from "@partygame/shared/schema";

/** The part of a connected room that non-UI clients (bots, terminal) need; `Room` from `@colyseus/sdk` satisfies it. */
export interface ConnectedRoom<TState extends BaseGameState> {
  readonly state: TState;
  onStateChange(callback: () => void): unknown;
  onLeave(callback: () => void): unknown;
  onMessage(type: string, callback: (payload: unknown) => void): () => void;
  send(type: string, payload?: unknown): void;
  request(type: string, payload: object): Promise<unknown>;
  leave(consented: boolean): Promise<unknown>;
}

/** Room options for `RoomConnector.create`; every field is forwarded to the server as a room option. */
export interface RoomCreateOptions {
  playerId: string;
  [key: string]: unknown;
}

/** Options for `RoomConnector.join`. `name` and `timeoutMs` are consumed by the connector; every other field, including `playerId`, is forwarded to the server as a join option. */
export interface RoomJoinOptions {
  playerId: string;
  /** Claim this name in the room once its state has synced; omit for spectators. */
  name?: string;
  /** How long to wait for the initial state sync, in ms (default 5000). */
  timeoutMs?: number;
  [key: string]: unknown;
}

/** Opens rooms of one game on one game server. */
export interface RoomConnector<TState extends BaseGameState> {
  /** Creates a room of the game and returns it connected. */
  create(options: RoomCreateOptions): Promise<ConnectedRoom<TState>>;
  /** Joins the room `roomId` (a code resolved with `resolveRoomCode`) and returns it once its state has synced. */
  join(roomId: string, options: RoomJoinOptions): Promise<ConnectedRoom<TState>>;
}
