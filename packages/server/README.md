# @partygame/server

Generic Colyseus server: host any game defined with `@partygame/core`.

| Import | What |
|---|---|
| `@partygame/server` | `createGameServer`, `jsonLineLogger`, `GameRoom`, `createApiHandler`, `RoomCodeService` |
| `@partygame/server/bun` | `startServer`: Bun entry point (WebSocket on 2567, API on 3001); options `StartServerOptions` (the `GameServerOptions` minus `transport`, plus the listening ports) |
| `@partygame/server/node` | `startNodeServer`, `serveApi`: in-process Node hosting (game server plus code API); options `NodeServerOptions` (`GameServerOptions` minus `transport`, plus ports and API access), `ServeApiOptions` |
| `@partygame/server/probe` | `ServerProbe` (`isGameServer`, `canConnect`, `answers`), `freePort`, `closeHttpServer`: port probing, no Colyseus |
| `@partygame/server/testing` | `bootTestServer`, `seatPlayers`, `joinPlayer`, `stateOf`, `waitUntil`, `testPlayerId`, `TestServer` for room tests; options `SeatPlayersOptions` (how many players to join, whether to start), `TestJoinOptions` (join as one player or spectator) |

## Host a game

A hosted game is a room name, your `defineGame` definition, your state class (extending `BaseGameState`) and your
`publicFields`: every state field that is neither listed there nor tagged `.view()` (fields of `BaseGameState` excepted)
fails `createGameServer` at startup, naming the class and each offending field. `startServer` is the Bun entry point; it serves the game on `port` (env `PORT`, default 2567; a non-integer or out-of-range value throws `PORT must be a whole number from 1 to 65535`) and `/api/resolve-code` on `apiPort` (env `API_PORT`, default 3001).

```ts
// server.ts
import { startServer } from "@partygame/server/bun";
import { ButtonGame } from "./src/game.js";
import { ButtonState } from "./src/state.js";

await startServer({
  games: [
    { roomName: "button", definition: ButtonGame, stateClass: ButtonState, publicFields: ["winner"] },
  ],
});
```

Clients join with `{ playerId, name? }`; `spectator: true` gives a TV display with no seat. A dropped player keeps the seat for `reconnectMs` (default 60 s, `DEFAULT_RECONNECT_MS`); an empty room lives `emptyRoomGraceMs` (default 120 s, `DEFAULT_EMPTY_ROOM_GRACE_MS`). A room records a replay snapshot at each transition only while the game keeps an action log, keeping at most `maxReplayTransitions` of them (default 5,000, `DEFAULT_MAX_REPLAY_TRANSITIONS`); once the log outgrows the bound the export refuses instead of shipping a truncated bundle. `GameRoomConfig` is the per-game configuration `createGameServer` hands to each `GameRoom`; game code does not build it. A room admits at most `maxPlayers + audienceSlots` connections (default 32, `DEFAULT_AUDIENCE_SLOTS`). With a `textFilter`, names are checked at join and on `SET_NAME` at the game's `filterLevel` option (default `"off"`); a refused join closes with code 4405. Every room writes one structured JSON line per lifecycle event (`room.created`, `player.joined`, `player.reconnected`, `player.left`, `action.rejected`, `room.disposed`) through the `logger` option — by default `jsonLineLogger`, one object per line on stdout; pass any `Logger` to route lines elsewhere. The framework guide's Logging section lists the events and field rules.

## Host without Bun

`createGameServer` returns the Colyseus `Server` (omit `transport` to use the bundled WebSocket one). `greet` (default `true`) prints the Colyseus banner and `gracefullyShutdown` (default `true`) registers its `SIGINT`/`SIGTERM` handlers; `bootTestServer` turns both off. `startNodeServer` runs it plus the code API in this process.

```ts
import { startNodeServer } from "@partygame/server/node";

const server = await startNodeServer({ games, port: 2567, apiPort: 3001 }); // free ports when omitted
await server.stop();
```

Share one `RoomCodeService` between `createGameServer({ games, roomCodeService })` and `createApiHandler(roomCodeService, { allowedOrigins?, limiter?, resolveCode?, trustProxy? })` (a pure `(request, info?) => Response`: CORS allow headers go out only for allowed origins — in list mode every response also carries `Vary: Origin` — a `limiter` throttles per remote address with 429 + `Retry-After`, and `trustProxy` keys that throttle on the last hop of `X-Forwarded-For`) when wiring your own HTTP layer. `RoomCodeService` has `generateCode()` (an unused random code, not registered; throws after repeated collisions), `generateAndRegister(roomId)` (binds a code to a room; the server calls it, game code should not) and `resolveByRoomId(roomId)` (the bound code or `undefined`).

Content-directory loading (`loadJsoncDir`) lives in [`@partygame/content`](../content/README.md).

## Private views

Tag a synced field `.view()` and reveal entries per player. The room re-applies views when a player reconnects, so call `hideFrom` before deleting an entry.

```ts
// in a phase, with `secrets: t.map(SecretSchema).view()` on the state
const secret = new SecretSchema();
secret.word = "banana";
ctx.state.secrets.set(playerId, secret);
ctx.showTo(playerId, secret);
// later
ctx.hideFrom(playerId, secret);
ctx.state.secrets.delete(playerId);
```

## Test a room

`bootTestServer` starts a real server on a free port; `seatPlayers` joins and names several players and waits until the server sees them ready.

```ts
import { bootTestServer, seatPlayers, stateOf, waitUntil } from "@partygame/server/testing";

const t = await bootTestServer({ games });
const room = await t.createRoom("button");
const [ann, bob] = await seatPlayers(t, room, { stateClass: ButtonState, count: 2, start: true });

ann.act("PRESS");                                  // ACTION { type: "PRESS" }
await waitUntil(() => stateOf(room, ButtonState).winner === ann.playerId, "winner");
bob.errors;                                        // every ERROR bob received
await t.shutdown();                                // t.cleanup() between tests
```

`t.join(room, { playerId })` joins one raw client; `t.endpoint` and `await t.serveApi()` expose the URLs for real client managers.

Depends on: `@partygame/client-utils`, `@partygame/content` (types only), `@partygame/core`, `@partygame/shared`, `@colyseus/core`, `@colyseus/bun-websockets`, `@colyseus/schema`, `@colyseus/sdk`, `zod`

Guide: [docs/framework/README.md#server](../../docs/framework/README.md#server)
