# Colyseus Testing Documentation

> **Versions:** none installed. `@colyseus/testing` and `@colyseus/tools` are intentionally not dependencies; the repo ships its own harness.

## Overview
Every server and game integration test runs a **real Colyseus server on a free port** through `@partygame/server/testing` (`packages/server/src/testing/index.ts`), which also serves game authors. No test mocks `colyseus`, `@colyseus/core` or `@colyseus/schema`.

## Harness API
| Export | Description |
|---|---|
| `bootTestServer({ games, reconnectMs?, emptyRoomGraceMs?, roomCodeService? })` | `createGameServer` on a free port with the default ws transport and short timings (reconnect 1 s, empty grace 30 s). Resolves a `TestServer`. |
| `t.createRoom(roomName, options?)` | `matchMaker.createRoom`; resolves the live server-side `Room` (inspect `room.state`, `room.clients`). |
| `t.join(room, { playerId, name?, spectator? })` | `sdk.joinById`; resolves the SDK `Room`. Send `SET_NAME` yourself to become ready. |
| `t.sdk` | The `ColyseusSDK`, for example `t.sdk.reconnect(token)`. |
| `t.cleanup()`, `t.shutdown()` | `matchMaker.disconnectAll()` between tests; `gracefullyShutdown(false)` in `afterAll`. |
| `waitUntil(predicate, label, timeoutMs?, stepMs?)` | Polling barrier. **Use it instead of waiting for a patch**: a patch fires on the 50 ms tick whether or not your message was processed. |
| `collectMessages(clientRoom, type)` | Records every message of `type` the client receives. |
| `sleep(ms)` | Only for "nothing happened" assertions. |

Request/response is tested with `await client.request<Payload, ActionResult>("ACTION", { ... })` (`GameRoom.game.test.ts`). Client-side continuity across the SDK's automatic reconnect is tested by setting `client.reconnection.minUptime = 0` and closing the socket with `CloseCode.MAY_TRY_RECONNECT` (`GameRoom.reconnect.test.ts`).

## Why not `@colyseus/testing`
- 0.18.6 loads under Vitest now (the 0.17 `require()`-in-`.mjs` failure is gone) but needs `@colyseus/tools` 0.18.x as a peer, which pulls in `@pm2/io` and `dotenv`.
- It adds nothing we lack: `ColyseusTestServer` is `createRoom` / `connectTo` / `cleanup` / `shutdown` plus `http`. Our harness has the same plus `waitUntil`, `collectMessages` and `playerId`-aware joins, and it is public API for game authors, who should not need extra packages.
- To adopt it later: `bun add -d @colyseus/testing @colyseus/tools`; `boot(server)` returns a `ColyseusTestServer` and adds `Room.waitForMessage` / `waitForNextPatch`.

## Gotchas
- `packages/server/vitest.config.ts` sets `fileParallelism: false` (one server per file, shared matchmaker singleton).
- Vitest/oxc transform TypeScript natively now; the old decorator transform plugin is gone with Schema 5.
- Never mock the module under test (AGENTS.md: "Over-mocking makes tests vacuous").
- `packages/server/tests/fixtures/buzzer.ts` is the reference fixture game (a `.view()` map, a timed phase, options).

## References
- [colyseus.md](colyseus.md), [Colyseus testing docs](https://docs.colyseus.io/tools/testing)
