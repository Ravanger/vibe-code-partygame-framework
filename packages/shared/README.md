# @partygame/shared

Wire protocol (message names, error codes, zod schemas), limits and browser-safe state classes.

| Import | What |
|---|---|
| `@partygame/shared` | `ClientMessage`, `ServerMessage`, `ErrorCode`, `ActionResult`, `ServerError`, `isActionResult`, `isServerError`, `LOBBY_PHASE`, zod schemas (`RoomCodeSchema`, `JoinOptionsSchema`, ...), `NAME_MAX_LENGTH`, `ROOM_CODE_LENGTH`, `ROOM_CODE_ALPHABET`, `sanitizeRoomCode`, error model (`FrameworkError`, `CLOSE_CODES`, `closeCodeEntry`, `CLIENT_MESSAGES`) |
| `@partygame/shared/schema` | `BaseGameState`, `PlayerSchema`: extend these in your game state |

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

Other codes: `INVALID_ACTION`, `UNKNOWN_ACTION`, `WRONG_PHASE`, `UNAUTHORIZED`, `NOT_ENOUGH_PLAYERS`, `NOT_ACTIVE`, `NAME_TAKEN`, `KICKED`, `INTERNAL`.

`LOBBY_PHASE`, `START_GAME`, `KICK_PLAYER`, `END_GAME` and `SET_OPTIONS` name the built-ins. `NAME_MAX_LENGTH` caps player names. `ROOM_CODE_LENGTH` and `ROOM_CODE_ALPHABET` define the room-code format that `RoomCodeSchema` enforces; `sanitizeRoomCode` cleans user input to it.

Depends on: `@colyseus/schema`, `zod`

Guide: [docs/framework/README.md#client-sdk](../../docs/framework/README.md#client-sdk)
