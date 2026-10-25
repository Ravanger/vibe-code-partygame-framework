import { z } from "zod";
import {
  MAX_ENVELOPE_KEYS,
  MAX_SEATS,
  NAME_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "./limits.js";

/** Message names a client may send to the room. */
export const ClientMessage = {
  SET_NAME: "SET_NAME",
  ACTION: "ACTION",
  /** Host-only request that answers with the room's replay bundle (see {@link ExportReplayResponse}). */
  EXPORT_REPLAY: "EXPORT_REPLAY",
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
  /** Free text (an action's declared text field or a player name) failed the room's text filter. */
  CONTENT_REJECTED: "CONTENT_REJECTED",
  /** `SET_NAME` with a name another seat already has. */
  NAME_TAKEN: "NAME_TAKEN",
  /** Sent by the server to a player the host removed. */
  KICKED: "KICKED",
  /** The server failed while handling the action. Only ever a request's answer, never pushed. */
  INTERNAL: "INTERNAL",
  /** The player sent more messages than their rate limit allows; the message was dropped. */
  RATE_LIMITED: "RATE_LIMITED",
  /** Client-side only: an action was sent with no room joined. Never sent by the server. */
  NOT_CONNECTED: "NOT_CONNECTED",
  /** Client-side only: the request failed in transit (network drop, timeout). Never sent by the server. */
  CONNECTION_LOST: "CONNECTION_LOST",
  /** Client-side only: the resolve-code API knows no room for the typed code. Never sent by the server. */
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  /** Client-side only: the server's reply to a request was not an `ActionResult`. Never sent by the server. */
  BAD_REPLY: "BAD_REPLY",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Payload of an `ERROR` server message. `action` is the rejected action type; only `ctx.reject` and
 * invalid-payload rejections carry it, framework rejections (unknown action, wrong phase, unauthorized,
 * not active, built-in refusals) omit it.
 */
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

/**
 * The framework version that produced a session; recorded in exported replay bundles so a viewer can
 * check compatibility. Bump together with the package versions.
 */
export const FRAMEWORK_VERSION = "0.1.0";

/**
 * Answer to `room.request(ClientMessage.EXPORT_REPLAY)`. The host receives the room's replay bundle —
 * the shape of `ReplayBundleSchema` from `@partygame/core/replay`; a non-host receives a refusal shaped
 * like a rejected {@link ActionResult} with `ErrorCode.UNAUTHORIZED`.
 */
export type ExportReplayResponse = { ok: false; error: ServerError } | Record<string, unknown>;

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

/**
 * Minimal shape of any action: a SCREAMING_SNAKE_CASE `type`, at most {@link MAX_ENVELOPE_KEYS} keys
 * in total; other fields pass through for the phase's own schema.
 */
export const ActionEnvelopeSchema = z
  .object({ type: z.string().regex(ACTION_NAME_PATTERN) })
  .passthrough()
  .superRefine((envelope, ctx) => {
    if (Object.keys(envelope).length > MAX_ENVELOPE_KEYS) {
      ctx.addIssue({
        code: "custom",
        message: `An action envelope has at most ${MAX_ENVELOPE_KEYS} keys`,
      });
    }
  });

/** Payload of `SET_NAME`: trimmed, 1 to {@link NAME_MAX_LENGTH} characters, no control characters. */
export const SetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(NAME_MAX_LENGTH)
  .refine((name) => /^[^\p{Cc}]+$/u.test(name));

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]` + `{${ROOM_CODE_LENGTH}}$`);

/** A room code: {@link ROOM_CODE_LENGTH} letters from {@link ROOM_CODE_ALPHABET}. */
export const RoomCodeSchema = z.string().regex(ROOM_CODE_PATTERN);

/** Stable client-generated player identifier: 8-64 of `A-Z a-z 0-9 _ -`, never an `Object.prototype` key such as `__proto__`. */
export const PlayerIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .refine((id) => !Object.hasOwn(Object.prototype, id));

/**
 * The wire/log protocol version every first-party client sends and the server compares against.
 * Bump it on any breaking change to the wire format or the action-log format; a mismatch is a
 * close, not a negotiation (see docs/framework/README.md, Protocol versioning).
 */
export const PROTOCOL_VERSION = 1;

/** Options a client passes when joining a room. `spectator` joins without taking a seat. */
export const JoinOptionsSchema = z.object({
  playerId: PlayerIdSchema,
  name: SetNameSchema.optional(),
  spectator: z.boolean().optional(),
  /** The client's per-seat credential; one per session for browsers, one per join for bots and terminal clients. Optional so a missing one gets the server's own refusal, not an invalid-options error. */
  seatSecret: z.string().min(16).max(128).optional(),
  /** The protocol version the client speaks; optional so a missing one gets the version-mismatch close, not an invalid-options error. */
  protocolVersion: z.number().int().optional(),
});

/**
 * Framework keys a client may pass when creating a room. `seats` makes the room watch-only for
 * everyone else: only the listed playerIds can take a seat, spectators still join.
 */
export const RoomOptionsSchema = z.object({
  seats: z.array(PlayerIdSchema).max(MAX_SEATS).optional(),
  /** The protocol version the client speaks; optional as in {@link JoinOptionsSchema}. */
  protocolVersion: z.number().int().optional(),
});

/** Body of `GET /api/resolve-code`: the room id, or why the code did not resolve. */
export const ResolveCodeResponseSchema = z.union([
  z.object({ roomId: z.string() }),
  z.object({ error: z.string() }),
]);
