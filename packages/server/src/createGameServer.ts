import type { ServerOptions, Transport } from "@colyseus/core";
import type { TextFilter } from "@partygame/content/filter";
import type { GameDefinition, Logger } from "@partygame/core";
import { assertSyncedFields, type BaseGameState } from "@partygame/shared/schema";
import { GameColyseusServer } from "./gameTransport.js";
import { jsonLineLogger } from "./logger.js";
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
  /**
   * The state's public fields. Every field of `stateClass` that is neither listed here nor tagged
   * `.view()` (fields of `BaseGameState` excepted) fails startup in {@link createGameServer}.
   */
  publicFields?: readonly string[];
}

/** Options for `createGameServer`; every field except `games` has a default. */
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
  /** Structured lifecycle logger for every room. Defaults to {@link jsonLineLogger} (one JSON line per event on stdout). */
  logger?: Logger;
  /** Print the Colyseus start-up banner when the server listens. Default `true`; tests turn it off. */
  greet?: boolean;
  /**
   * Register Colyseus' process signal handlers (`SIGINT`, `SIGTERM`, ...) that shut the server down
   * gracefully. Default `true`; a process that starts many servers (a test worker) turns it off and
   * calls `gracefullyShutdown` itself.
   */
  gracefullyShutdown?: boolean;
}

/** Default time in milliseconds a dropped player's seat is held. */
export const DEFAULT_RECONNECT_MS = 60_000;
/** Default time in milliseconds an empty room lives before it is disposed. */
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

/**
 * Reports one observed (not enforced) limit hit. With a `logger` it writes the structured line
 * `rate.limit { key }` through it; without one it falls back to `console.warn`.
 */
export function warnRateLimit(key: string, logger?: Logger): void {
  if (logger !== undefined) {
    logger.warn("rate.limit", { key });
    return;
  }
  console.warn(`[rate-limit] ${key} is over its limit`);
}

/** The limiter and resolved bucket the HTTP entries use to throttle `/api/resolve-code`. */
export function createResolveCodeThrottle(
  rateLimits?: RateLimits,
  logger?: Logger,
): {
  limiter: RateLimiter;
  bucket: TokenBucket;
} {
  const resolved = resolveRateLimits(rateLimits);
  return {
    limiter: new RateLimiter({
      mode: resolved.mode,
      ...(resolved.mode === "observe" ? { onObserve: (key) => warnRateLimit(key, logger) } : {}),
    }),
    bucket: resolved.resolveCode,
  };
}

/** Colyseus server with one {@link GameRoom} per game. */
export function createGameServer(options: GameServerOptions): GameColyseusServer {
  const roomCodeService = options.roomCodeService ?? new RoomCodeService();
  const processOptions: ServerOptions = {
    ...(options.greet !== undefined ? { greet: options.greet } : {}),
    ...(options.gracefullyShutdown !== undefined
      ? { gracefullyShutdown: options.gracefullyShutdown }
      : {}),
  };
  const defaultTransportOptions: ServerOptions & { maxPayload?: number } = {
    ...processOptions,
    maxPayload: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
  };
  const server = new GameColyseusServer(
    options.transport
      ? { ...processOptions, transport: options.transport }
      : defaultTransportOptions,
  );
  // One logger for the rooms and for observe-mode limit hits; a configured logger wins over stdout.
  const logger = options.logger ?? jsonLineLogger();
  const rateLimits = resolveRateLimits(options.rateLimits);
  const rateLimiter = new RateLimiter({
    mode: rateLimits.mode,
    ...(rateLimits.mode === "observe" ? { onObserve: (key) => warnRateLimit(key, logger) } : {}),
  });
  for (const game of options.games) {
    assertSyncedFields(game.stateClass, game.publicFields ?? []);
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
      logger,
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
