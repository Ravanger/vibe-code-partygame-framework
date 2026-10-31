# @partygame/shared

Wire protocol (message names, error codes, zod schemas), limits and browser-safe state classes.

| Import | What |
|---|---|
| `@partygame/shared` | `ClientMessage`, `ServerMessage`, `ErrorCode`, `ActionResult`, `ServerError`, `isActionResult`, `isServerError`, `LOBBY_PHASE`, `PROTOCOL_VERSION`, zod schemas (`PlayerIdSchema`, `RoomCodeSchema`, `JoinOptionsSchema`, ...), `NAME_MAX_LENGTH`, `MAX_SEATS`, `MAX_OPTIONS_JSON_LENGTH`, `ROOM_CODE_LENGTH`, `ROOM_CODE_ALPHABET`, `sanitizeRoomCode`, error model (`FrameworkError`, `CLOSE_CODES`, `closeCodeEntry`, `CLIENT_MESSAGES`) |
| `@partygame/shared/schema` | `BaseGameState`, `PlayerSchema`: extend these in your game state; `assertSyncedFields(stateClass, allow)` (fail loudly when a state field is neither allow-listed nor `.view()`-tagged); `syncedJsonOf` (plain JSON of a synced state, `.view()` fields dropped) and its inverse `syncedStateFromJson` (a fresh instance filled from that JSON) |

Client helpers (polling, room-code resolution, share links, argument parsing) live in [`@partygame/client-utils`](../client-utils/README.md).

## Define your game state

`BaseGameState` carries `phase`, `phaseEndsAt`, `serverNow`, `roomCode`, `canStart`, `minPlayers`, `maxPlayers`, `spectatorCount`, `notice`, `options` (JSON) and `players` (keyed by `playerId`). Extend it with `@colyseus/schema` 5's decorator-free `t.*` fields.

```ts
import { type SchemaType, t } from "@colyseus/schema";
import { BaseGameState } from "@partygame/shared/schema";

export const ButtonState = BaseGameState.extend(
  { winner: t.string().default("") },
  "ButtonState",
);
export type ButtonState = SchemaType<typeof ButtonState>;
```

Import from `@partygame/shared/schema` in your `state.ts` so the browser bundle never reaches `@colyseus/core`. `PlayerSchema` is one seat: `id`, `name`, `role` (`"host" | "player"`), `isReady`, `isConnected`, `isActive`.

## Handle action results

`room.request(ClientMessage.ACTION, ...)` resolves with an `ActionResult`: `{ ok: true }` or `{ ok: false, error }`. A rejection is also pushed as an `ERROR` message. `isActionResult` and `isServerError` narrow the `unknown` replies.

```ts
import { ClientMessage, ErrorCode, isActionResult, isServerError, ServerMessage } from "@partygame/shared";

const reply: unknown = await room.request(ClientMessage.ACTION, { type: "PRESS" });
if (isActionResult(reply) && !reply.ok && reply.error.code === ErrorCode.NOT_ALLOWED) {
  showToast(reply.error.message);
}

room.onMessage(ServerMessage.ERROR, (payload: unknown) => {
  if (isServerError(payload)) showToast(payload.message);
});
```

Other codes: `INVALID_ACTION`, `UNKNOWN_ACTION`, `WRONG_PHASE`, `UNAUTHORIZED`, `NOT_ENOUGH_PLAYERS`, `NOT_ALLOWED`, `NOT_ACTIVE`, `CONTENT_REJECTED`, `NAME_TAKEN`, `KICKED`, `INTERNAL`, `RATE_LIMITED`, and the client-only `NOT_CONNECTED`, `CONNECTION_LOST`, `BAD_REPLY`, `ROOM_NOT_FOUND`.

`LOBBY_PHASE`, `START_GAME`, `KICK_PLAYER`, `END_GAME` and `SET_OPTIONS` name the built-ins. `NAME_MAX_LENGTH` caps player names; `MAX_SEATS` caps the `seats` room option; `MAX_OPTIONS_JSON_LENGTH` caps serialized options at room creation and in `SET_OPTIONS`. `ROOM_CODE_LENGTH` and `ROOM_CODE_ALPHABET` define the room-code format that `RoomCodeSchema` enforces; `sanitizeRoomCode` cleans user input to it.

`ACTION_NAME_PATTERN` validates custom action names (SCREAMING_SNAKE_CASE, at most 64 characters); `ActionEnvelopeSchema` is the minimal envelope every client message passes before the phase's own payload schema; `RoomOptionsSchema` covers the framework keys a client may pass when creating a room (`seats` makes the room watch-only for everyone else: only the listed playerIds can take a seat, spectators still join).

Depends on: `@colyseus/schema`, `zod`

Guide: [docs/framework/README.md#client-sdk](../../docs/framework/README.md#client-sdk)
