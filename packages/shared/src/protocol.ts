import { z } from "zod";
import { NAME_MAX_LENGTH } from "./limits.js";

/** Message names a client may send to the room. */
export const ClientMessage = {
  SET_NAME: "SET_NAME",
  ACTION: "ACTION",
} as const;

/** Message names the room sends to a single client for protocol-level events. */
export const ServerMessage = {
  ERROR: "ERROR",
} as const;

/** Reason an action was rejected; delivered inside a {@link ServerError}. */
export const ErrorCode = {
  INVALID_ACTION: "INVALID_ACTION",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  WRONG_PHASE: "WRONG_PHASE",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  NOT_ALLOWED: "NOT_ALLOWED",
  NOT_ACTIVE: "NOT_ACTIVE",
  /** `SET_NAME` with a name another seat already has. */
  NAME_TAKEN: "NAME_TAKEN",
  /** Sent by the server to a player the host removed. */
  KICKED: "KICKED",
  /** The server failed while handling the action. Only ever a request's answer, never pushed. */
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Payload of an `ERROR` server message. `action` is the rejected action type, when known. */
export interface ServerError {
  code: ErrorCode;
  message: string;
  action?: string;
}

/**
 * Answer to `room.request(ClientMessage.ACTION, action)`. `ACTION` is one handler: `room.send`
 * stays fire-and-forget, `room.request` additionally resolves with the outcome. A rejection is
 * still pushed as `ERROR` either way.
 */
export type ActionResult = { ok: true } | { ok: false; error: ServerError };

/** True for a well-formed {@link ServerError}; the payload of `ERROR` arrives as `unknown`. */
export function isServerError(value: unknown): value is ServerError {
  if (typeof value !== "object" || value === null) return false;
  if (!("code" in value) || !("message" in value)) return false;
  const { code, message } = value;
  if (typeof message !== "string") return false;
  if (!Object.values(ErrorCode).some((known) => known === code)) return false;
  return !("action" in value) || value.action === undefined || typeof value.action === "string";
}

/** True for a well-formed {@link ActionResult}; the answer to `room.request` arrives as `unknown`. */
export function isActionResult(value: unknown): value is ActionResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if (value.ok === true) return true;
  return value.ok === false && "error" in value && isServerError(value.error);
}

/** Name of the built-in phase every game starts in. */
export const LOBBY_PHASE = "Lobby";

/** Built-in host action that leaves the Lobby for the game's start phase. */
export const START_GAME = "START_GAME";

/** Built-in host action `{ type, playerId }`: remove a player. Any phase; not yourself. */
export const KICK_PLAYER = "KICK_PLAYER";

/** Built-in host action: any phase but the Lobby; runs onEndGame, then returns everyone to the Lobby. */
export const END_GAME = "END_GAME";

/** Built-in host action `{ type, ...partialOptions }`: change the room options. Lobby only. */
export const SET_OPTIONS = "SET_OPTIONS";

/** Valid action names: SCREAMING_SNAKE_CASE, at most 64 characters. */
export const ACTION_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/** Minimal shape of any action: a SCREAMING_SNAKE_CASE `type`; other fields pass through for the phase's own schema. */
export const ActionEnvelopeSchema = z
  .object({ type: z.string().regex(ACTION_NAME_PATTERN) })
  .passthrough();

/** Payload of `SET_NAME`: trimmed, 1 to {@link NAME_MAX_LENGTH} characters. */
export const SetNameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH);

/** Four-letter room code. */
export const RoomCodeSchema = z.string().regex(/^[A-Z]{4}$/);

/** Stable client-generated player identifier. */
export const PlayerIdSchema = z.string().min(8).max(64);

/** Options a client passes when joining a room. `spectator` joins without taking a seat. */
export const JoinOptionsSchema = z.object({
  playerId: PlayerIdSchema,
  name: z.string().optional(),
  spectator: z.boolean().optional(),
});

/**
 * Framework keys a client may pass when creating a room. `seats` makes the room watch-only for
 * everyone else: only the listed playerIds can take a seat, spectators still join.
 */
export const RoomOptionsSchema = z.object({
  seats: z.array(PlayerIdSchema).optional(),
});

/** Body of `GET /api/resolve-code`: the room id, or why the code did not resolve. */
export const ResolveCodeResponseSchema = z.union([
  z.object({ roomId: z.string() }),
  z.object({ error: z.string() }),
]);
