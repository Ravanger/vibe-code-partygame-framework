# @partygame/client-utils

Browser- and Node-safe client helpers: room-code resolution, share links, waiting, argument bounds, seat-name claiming and the code API's base URL. No `node:` imports, no Colyseus.

| Import | What |
|---|---|
| `@partygame/client-utils` | `waitFor`, `resolveRoomCode`, `RoomCodeError`, `joinUrl`, `tvUrl`, `between`, type `Parsed`, `claimName`, type `SeatRoom`, `apiBaseOf`, types `RoomConnector`, `ConnectedRoom`, `RoomCreateOptions`, `RoomJoinOptions` |

## Resolve a room code

```ts
import { resolveRoomCode } from "@partygame/client-utils";

const roomId = await resolveRoomCode("http://192.168.1.5:3001", "ABCD"); // GET /api/resolve-code; rejects with a RoomCodeError (reason "not-found" | "bad-reply")
```

`joinUrl(base, code)` and `tvUrl(base, code)` build the links a host shares; `waitFor(predicate, what, timeoutMs, stepMs?)` polls until the predicate holds; `between(value, min, max)` validates an integer argument.

`claimName(room, playerId, name, timeoutMs?)` sends `SET_NAME` on any room shaped like `SeatRoom` and waits until the seat carries the name (the server's refusal is rethrown); `apiBaseOf(endpoint, apiPort)` maps a game-server endpoint (`ws:`/`wss:`) to its `http(s)://host:apiPort` code API base.

## Room connector

`RoomConnector<TState>` is the seam non-UI clients (bots, terminal) use to open rooms: `create(options)` opens a new room and `join(roomId, options)` joins one by its id (a code resolved with `resolveRoomCode`), both returning a connected `ConnectedRoom<TState>` once its state has synced. `options` carries `playerId` plus anything forwarded to the server as room/join options; `join` additionally consumes `name` (claim it in the room) and `timeoutMs` (state-sync wait). The package is Colyseus-free by design, so the interface lives here and the Colyseus implementation (`ColyseusConnector`) lives in `@partygame/bots`.

Depends on: `@partygame/shared`
