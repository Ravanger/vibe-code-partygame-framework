# @partygame/server

Generic Colyseus server: host any game defined with `@partygame/core`.

| Import | What |
|---|---|
| `@partygame/server` | `createGameServer`, `GameRoom`, `createApiHandler`, `RoomCodeService` |
| `@partygame/server/bun` | `startServer`: Bun entry point (WebSocket on 2567, API on 3001) |
| `@partygame/server/node` | `startNodeServer`, `serveApi`, `freePort`, `ServerProbe`: Node runtimes and tests |
| `@partygame/server/content` | `loadJsoncDir`: load and validate a folder of `.jsonc` content files |
| `@partygame/server/testing` | `bootTestServer`, `seatPlayers`, `joinPlayer`, `stateOf`, `waitUntil`, `testPlayerId`, `TestServer` for room tests |

## Host a game

A hosted game is a room name, your `defineGame` definition and your state class (extending `BaseGameState`). `startServer` is the Bun entry point; it serves the game on `port` (env `PORT`, default 2567) and `/api/resolve-code` on `apiPort` (env `API_PORT`, default 3001).

```ts
// server.ts
import { startServer } from "@partygame/server/bun";
import { ButtonGame } from "./src/game.js";
import { ButtonState } from "./src/state.js";

await startServer({ games: [{ roomName: "button", definition: ButtonGame, stateClass: ButtonState }] });
```

Clients join with `{ playerId, name? }`; `spectator: true` gives a TV display with no seat. A dropped player keeps the seat for `reconnectMs` (default 60 s); an empty room lives `emptyRoomGraceMs` (default 120 s).

## Host without Bun

`createGameServer` returns the Colyseus `Server` (omit `transport` to use the bundled WebSocket one). `startNodeServer` runs it plus the code API in this process.

```ts
import { startNodeServer } from "@partygame/server/node";

const server = await startNodeServer({ games, port: 2567, apiPort: 3001 }); // free ports when omitted
await server.stop();
```

Share one `RoomCodeService` between `createGameServer({ games, roomCodeService })` and `createApiHandler(roomCodeService)` (a pure `(Request) => Response`) when wiring your own HTTP layer.

## Load content from files

Drop commented JSON files in a folder and validate them with a zod schema. Invalid files are skipped with a warning; a repeated id throws.

```ts
import { loadJsoncDir } from "@partygame/server/content";
import { z } from "zod";

const Item = z.object({ id: z.string(), text: z.string() });
const items = await loadJsoncDir("content/items", Item, {
  idOf: (item) => item.id,
  label: "Item",
});
```

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

Depends on: `@partygame/core`, `@partygame/shared`, `@colyseus/core`

Guide: [docs/framework/README.md#server](../../docs/framework/README.md#server)
