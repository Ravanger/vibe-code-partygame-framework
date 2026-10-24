import { Server, type ServerOptions, type Transport } from "@colyseus/core";
import type { TextFilter } from "@partygame/content/filter";
import type { GameDefinition } from "@partygame/core";
import type { BaseGameState } from "@partygame/shared/schema";
import { GameRoom, type GameRoomConfig } from "./rooms/GameRoom.js";
import { RoomCodeService } from "./services/RoomCodeService.js";

/** One game the server hosts under `roomName`. */
export interface HostedGame {
  roomName: string;
  definition: GameDefinition<BaseGameState, unknown, unknown>;
  stateClass: new () => BaseGameState;
}

export interface GameServerOptions {
  games: HostedGame[];
  /** Shared with the API handler so `/api/resolve-code` sees the same rooms. Defaults to a fresh one. */
  roomCodeService?: RoomCodeService;
  /** Omit under Node/Vitest to use Colyseus' bundled WebSocket transport. */
  transport?: Transport;
  /**
   * Largest WebSocket frame the server accepts, in bytes. Frames above it close only that
   * connection (code 1009) and leave the room untouched. Default {@link DEFAULT_MAX_PAYLOAD_BYTES}.
   */
  maxPayloadBytes?: number;
  /** How long a dropped player's seat is held. Default 60 s. */
  reconnectMs?: number;
  /** How long an empty room lives before it is disposed. Default 120 s. */
  emptyRoomGraceMs?: number;
  /** When set, player names are checked against it at join and on `SET_NAME`, at the level of each game's `filterLevel`. */
  textFilter?: TextFilter;
}

export const DEFAULT_RECONNECT_MS = 60_000;
export const DEFAULT_EMPTY_ROOM_GRACE_MS = 120_000;
/** Default largest accepted WebSocket frame (bytes); the transports' own default, now made explicit. */
export const DEFAULT_MAX_PAYLOAD_BYTES = 4096;

/** Colyseus server with one {@link GameRoom} per game. */
export function createGameServer(options: GameServerOptions): Server {
  const roomCodeService = options.roomCodeService ?? new RoomCodeService();
  const defaultTransportOptions: ServerOptions & { maxPayload?: number } = {
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
  };
  const server = new Server(
    options.transport ? { transport: options.transport } : defaultTransportOptions,
  );
  for (const game of options.games) {
    const config: GameRoomConfig = {
      definition: game.definition,
      stateClass: game.stateClass,
      roomCodeService,
      reconnectMs: options.reconnectMs ?? DEFAULT_RECONNECT_MS,
      emptyRoomGraceMs: options.emptyRoomGraceMs ?? DEFAULT_EMPTY_ROOM_GRACE_MS,
      ...(options.textFilter ? { textFilter: options.textFilter } : {}),
    };
    server.define(
      game.roomName,
      class extends GameRoom {
        constructor() {
          super(config);
        }
      },
    );
  }
  return server;
}
