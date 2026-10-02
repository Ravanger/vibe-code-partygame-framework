# @partygame/shared

Wire protocol (message names, error codes), browser-safe state classes, and helpers used everywhere.

| Import | What |
|---|---|
| `@partygame/shared` | `ClientMessage`, `ServerMessage`, `ErrorCode`, `ActionResult`, `ServerError`, `isActionResult`, `isServerError`, `LOBBY_PHASE`, zod schemas (`RoomCodeSchema`, `JoinOptionsSchema`, ...); `waitFor`, `resolveRoomCode`, `joinUrl`, `tvUrl`, `NAME_MAX_LENGTH` |
| `@partygame/shared/schema` | `BaseGameState`, `PlayerSchema`: extend these in your game state |

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

## Share links

```ts
import { joinUrl, tvUrl } from "@partygame/shared";

joinUrl("https://party.example/", "ABCD"); // https://party.example/?code=ABCD
tvUrl("https://party.example/", "ABCD");   // https://party.example/?tv=ABCD
```

## Other helpers

```ts
import { resolveRoomCode, waitFor } from "@partygame/shared";

const roomId = await resolveRoomCode("http://localhost:3001", "ABCD"); // GET /api/resolve-code
await waitFor(() => room.state.phase === "Done", "the game to finish", 5_000); // polls, then throws
```

`LOBBY_PHASE`, `START_GAME`, `KICK_PLAYER`, `END_GAME` and `SET_OPTIONS` name the built-ins. `NAME_MAX_LENGTH` caps player names. `Parsed<T>` and `between(value, min, max)` help with argument parsing.

Depends on: `@colyseus/schema`, `zod`

Guide: [docs/framework/README.md#client-sdk](../../docs/framework/README.md#client-sdk) ([Helpers](../../docs/framework/README.md#helpers))
