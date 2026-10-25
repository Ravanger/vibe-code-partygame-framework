import { Server, type ServerOptions, type Transport } from "@colyseus/core";
import type { TextFilter } from "@partygame/content/filter";
import type { GameDefinition } from "@partygame/core";
import type { BaseGameState } from "@partygame/shared/schema";
import {
  RateLimiter,
  type RateLimits,
  type ResolvedRateLimits,
  type TokenBucket,
} from "./RateLimiter.js";
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
  /**
   * Maximum number of concurrent rooms across all games; a create beyond it closes with the
   * `SERVER_FULL` code (4429). Default {@link DEFAULT_MAX_ROOMS}; `Infinity` removes the cap.
   */
  maxRooms?: number;
  /** How long a dropped player's seat is held. Default 60 s. */
  reconnectMs?: number;
  /** How long an empty room lives before it is disposed. Default 120 s. */
  emptyRoomGraceMs?: number;
  /**
   * Spectator (audience) connections a room admits on top of `maxPlayers`. The room's `maxClients`
   * is `maxPlayers + audienceSlots`, so once it is full Colyseus refuses further joins. Default
   * {@link DEFAULT_AUDIENCE_SLOTS}.
   */
  audienceSlots?: number;
  /** When set, player names are checked against it at join and on `SET_NAME`, at the level of each game's `filterLevel`. */
  textFilter?: TextFilter;
  /**
   * Per-player and per-address rate limits ({@link RateLimits}). Every room enforces the action and
   * SET_NAME buckets through one shared limiter; the HTTP entries enforce `resolveCode` on
   * `/api/resolve-code` (429 with `Retry-After`).
   */
  rateLimits?: RateLimits;
}

export const DEFAULT_RECONNECT_MS = 60_000;
export const DEFAULT_EMPTY_ROOM_GRACE_MS = 120_000;
/** Default maximum number of concurrent rooms across all games. */
export const DEFAULT_MAX_ROOMS = 100;
/** Default spectator (audience) slots per room, on top of the game's `maxPlayers`. */
export const DEFAULT_AUDIENCE_SLOTS = 32;
/** Default largest accepted WebSocket frame (bytes); the transports' own default, now made explicit. */
export const DEFAULT_MAX_PAYLOAD_BYTES = 4096;
/** Default action limit per player: 10/s, burst 20. */
export const DEFAULT_ACTION_BUCKET: TokenBucket = { rate: 10, burst: 20 };
/** Default SET_NAME limit per player: 2/s, burst 2. */
export const DEFAULT_SET_NAME_BUCKET: TokenBucket = { rate: 2, burst: 2 };
/** Default `/api/resolve-code` limit per remote address: 1/s, burst 10. */
export const DEFAULT_RESOLVE_CODE_BUCKET: TokenBucket = { rate: 1, burst: 10 };

/** Resolve `rateLimits` against the defaults, which leave a normal party unaffected. */
export function resolveRateLimits(options?: RateLimits): ResolvedRateLimits {
  return {
    action: options?.action ?? DEFAULT_ACTION_BUCKET,
    setName: options?.setName ?? DEFAULT_SET_NAME_BUCKET,
    resolveCode: options?.resolveCode ?? DEFAULT_RESOLVE_CODE_BUCKET,
    mode: options?.mode ?? "enforce",
  };
}

/** Reports one observed (not enforced) limit hit; the observe-mode `onObserve` of {@link createGameServer}. */
export function warnRateLimit(key: string): void {
  console.warn(`[rate-limit] ${key} is over its limit`);
}

/** The limiter and resolved bucket the HTTP entries use to throttle `/api/resolve-code`. */
export function createResolveCodeThrottle(rateLimits?: RateLimits): {
  limiter: RateLimiter;
  bucket: TokenBucket;
} {
  const resolved = resolveRateLimits(rateLimits);
  return {
    limiter: new RateLimiter({
      mode: resolved.mode,
      ...(resolved.mode === "observe" ? { onObserve: warnRateLimit } : {}),
    }),
    bucket: resolved.resolveCode,
  };
}

/** Colyseus server with one {@link GameRoom} per game. */
export function createGameServer(options: GameServerOptions): Server {
  const roomCodeService = options.roomCodeService ?? new RoomCodeService();
  const defaultTransportOptions: ServerOptions & { maxPayload?: number } = {
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
  };
  const server = new Server(
    options.transport ? { transport: options.transport } : defaultTransportOptions,
  );
  const rateLimits = resolveRateLimits(options.rateLimits);
  const rateLimiter = new RateLimiter({
    mode: rateLimits.mode,
    ...(rateLimits.mode === "observe" ? { onObserve: warnRateLimit } : {}),
  });
  for (const game of options.games) {
    const config: GameRoomConfig = {
      definition: game.definition,
      stateClass: game.stateClass,
      roomCodeService,
      reconnectMs: options.reconnectMs ?? DEFAULT_RECONNECT_MS,
      emptyRoomGraceMs: options.emptyRoomGraceMs ?? DEFAULT_EMPTY_ROOM_GRACE_MS,
      maxRooms: options.maxRooms ?? DEFAULT_MAX_ROOMS,
      audienceSlots: options.audienceSlots ?? DEFAULT_AUDIENCE_SLOTS,
      ...(options.textFilter ? { textFilter: options.textFilter } : {}),
      rateLimiter,
      rateLimits,
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
