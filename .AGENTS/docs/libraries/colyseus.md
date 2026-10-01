# Colyseus Documentation

> **Versions (as resolved):** `@colyseus/core` 0.18.18, `@colyseus/bun-websockets` 0.18.3, `@colyseus/ws-transport` 0.18.4 (server devDep, used by tests), `@colyseus/sdk` 0.18.4. The `colyseus` meta package and `@colyseus/tools` are not installed: nothing imports them.
> Related: [colyseus-schema.md](colyseus-schema.md) (state, Schema 5.0.35), [colyseus-testing.md](colyseus-testing.md)

## Overview
Authoritative multiplayer server. `GameRoom` (`packages/server/src/rooms/GameRoom.ts`) extends `Room` from `@colyseus/core`, implements the core `RuntimeHost`, mutates a Schema state, and Colyseus patches it to clients every `patchRate` (50 ms). Everything is imported from `@colyseus/core`.

## Used in this repo

| Server API | Where / why |
|---|---|
| `new Server({ transport? })`, `server.define(name, RoomClass)`, `listen(port)` | `createGameServer.ts`. |
| `onCreate`, `onJoin`, `onDrop`, `onReconnect`, `onLeave`, `onDispose` | `GameRoom`. See Reconnection. |
| `this.onMessage("SET_NAME" \| "ACTION", handler)` | The only two client messages. `ACTION` also answers `room.request` (below). Validate with Zod `safeParse`, not the Standard Schema overload (see Rejected). |
| `this.clock.setTimeout/setInterval` | Phase timers and `serverNow`; cleared on dispose. |
| `this.maxClients`, `this.autoDispose = false` | Capacity; empty rooms are disposed by `GameRoom` after a grace period. |
| `this.allowReconnection(client, seconds)` | Hold a seat for a dropped client. |
| `client.view = new StateView()`, `client.sessionId` | Per-player visibility ([colyseus-schema.md](colyseus-schema.md)). |
| `CloseCode`, `ServerError`, `logger`, `matchMaker` | Close codes, join rejection, logging, test harness. |

| Client API (`@colyseus/sdk`) | Where |
|---|---|
| `new ColyseusSDK(endpoint)` (alias of `Client`) | Test harness; `GameConnectionManager` uses `Client`. |
| `create`, `joinById`, `joinOrCreate`, `reconnect(token)` | Host creates, guests join by resolved room id. |
| `room.send`, `room.request`, `room.onMessage`, `room.onLeave/onDrop/onReconnect/onError` | Messages and lifecycle. |
| `room.reconnectionToken`, `room.reconnection` | Token reconnect and automatic retry settings. |

## Request / response (new in 0.18)
`room.request(type, payload)` returns a promise. The server answers with the return value of the `onMessage(type, (client, msg, ctx) => ...)` handler; `ctx.reject(reason)`, a throw, or a missing handler reject it. `room.send` works against the same handler and ignores the return value.
- `ACTION` returns `ActionResult` (`packages/shared/src/protocol.ts`): `{ ok: true }` or `{ ok: false, error: ServerError }`. The same rejection is still pushed as `ERROR` (hooks can also push errors).
- A game hook that throws answers `{ ok: false, error: { code: "INTERNAL" } }` and pushes nothing.
- Spectators get `UNAUTHORIZED`.
- Default request timeout 10 s (`Room.defaultRequestTimeout`, or `{ timeout }` per call).

## Reconnection (0.18 flow)
- **Drop** (any close except `CONSENTED`): `onDrop(client)` marks the seat disconnected and awaits `allowReconnection(client, reconnectMs / 1000).catch(...)` (it also rejects for clients that are not fully joined).
- **Return with the token:** `onReconnect(client)`. The new `client` has the **same `sessionId`** and inherits the old `client.view`. A kicked player's token is refused by throwing `ServerError` from `onReconnect`.
- **Expiry or consented leave:** `onLeave(client)` removes the seat. Colyseus calls `onLeave` after a failed reconnection window, so there is no timer to schedule. If a new session with the same `playerId` has taken the seat meanwhile, `playerOf` no longer maps the old session and `onLeave` is a no-op.
- **New session, same `playerId`** (page reload without a valid token): `onJoin` reattaches the seat; the player's registered view refs are re-applied to the new `StateView`.
- The SDK reconnects **automatically** on close codes 1005/1006/1001/4010 (`room.reconnection`: `maxRetries` 15, backoff 100 ms to 5 s, `minUptime` 5 s). The `Room` object, `room.state`, every `Schema` instance and every state callback survive; the server resends the full state and the client reconciles it in place (asserted in `GameRoom.reconnect.test.ts`).

## Breaking changes 0.17 to 0.18 that touch us
- `client.id` removed, use `client.sessionId` (we never used `id`).
- `setMetadata()` replaces instead of merging (we do not use metadata).
- Schema field limit is 63 per class (`WitClashState` has 22 including `BaseGameState`).
- `@colyseus/schema` 4 to 5: decorators are optional; see [colyseus-schema.md](colyseus-schema.md).
- `@colyseus/testing` needs `@colyseus/tools` 0.18.x as a peer; we do not use it ([colyseus-testing.md](colyseus-testing.md)).
- `@colyseus/sdk` warns `onMessage() not registered for type 'X'` for a message with no listener. Register `ERROR` (and any private message) before connecting.
- Earlier: client package is `@colyseus/sdk` (was `colyseus.js`); `onLeave(client, code: number)`; generics are `Room<{ state, metadata, client }>`.

## Transports
| Context | Transport | Why |
|---|---|---|
| Production (`packages/server/src/bun.ts`) | `new BunWebSockets({ path: "/" })`, then `server.listen(port)` | Bun runtime. 0.18.3 works on Bun 1.4.2 (smoke-tested with the SDK, including `request`). |
| Vitest (Node) | No transport passed, so the default `@colyseus/ws-transport` is used | `@colyseus/bun-websockets` imports `bun`. `createGameServer({ transport })` is optional and omitted in tests. |

- `@colyseus/ws-transport` is an optional peer of `@colyseus/core`, satisfied by the server devDependencies. Production does not use it.
- Never import `@colyseus/bun-websockets` from code that tests load (`bun.ts` is the only importer).
- The SDK endpoint has no path suffix because the Bun transport is mounted at `/`.
- The room-code HTTP API (`/api/resolve-code`) is a separate `Bun.serve` on port 3001.

## Evaluated and rejected
- **`UniqueSessionPlugin`** (`colyseus/plugins/unique-session`): keyed on authenticated `client.auth.id` plus presence, anonymous clients are never enforced. Our seat identity is the client-generated `playerId` with take-over semantics, which it cannot express.
- **`IdleKickPlugin`**: kicks any client that has not sent a frame within `timeoutMs`; players who are thinking and TV screens would be removed. It adds behaviour, it deletes no code. `maxMessagesPerSecond` (default unlimited, closes the client with `WITH_ERROR`) is the built-in rate limit if the AGENTS.md rate-limiting mandate is implemented.
- **`onUncaughtException`** (experimental): wraps every hook and swallows errors, but `onJoin` is wrapped with rethrow, so our `safely` guard around roster hooks would still be needed.
- **Standard Schema validation** (`onMessage(type, zodSchema, handler)`): an invalid payload disconnects the client (`WITH_ERROR`). We answer with `ERROR` instead.
- `messages = { ... }` typed handlers, `defineInput`, prediction, rewind: for real-time games, not turn-based party games.

## Best Practices in This Project
- Validate every message with Zod; drive rules through the core `GameRuntime`, not room handlers.
- The server owns the clock (`state.phaseEndsAt`); use `this.clock` for timers that must die with the room.
- Set `maxClients` in `onCreate` so Colyseus rejects overflow joins.

## References
- [Colyseus docs](https://docs.colyseus.io), [0.18 migration guide](https://docs.colyseus.io/migrating/0.18), [0.18 release post](https://colyseus.io/blog/colyseus-018-is-here/)
