# @partygame/client-utils

Browser- and Node-safe client helpers: room-code resolution, share links, waiting, argument bounds, seat-name claiming and the code API's base URL. No `node:` imports, no Colyseus.

| Import | What |
|---|---|
| `@partygame/client-utils` | `waitFor`, `resolveRoomCode`, `joinUrl`, `tvUrl`, `between`, type `Parsed`, `claimName`, type `SeatRoom`, `apiBaseOf` |

## Resolve a room code

```ts
import { resolveRoomCode } from "@partygame/client-utils";

const roomId = await resolveRoomCode("http://192.168.1.5:3001", "ABCD"); // GET /api/resolve-code
```

`joinUrl(base, code)` and `tvUrl(base, code)` build the links a host shares; `waitFor(predicate, what, timeoutMs, stepMs?)` polls until the predicate holds; `between(value, min, max)` validates an integer argument.

`claimName(room, playerId, name, timeoutMs?)` sends `SET_NAME` on any room shaped like `SeatRoom` and waits until the seat carries the name (the server's refusal is rethrown); `apiBaseOf(endpoint, apiPort)` maps a game-server endpoint (`ws:`/`wss:`) to its `http(s)://host:apiPort` code API base.

Depends on: `@partygame/shared`
