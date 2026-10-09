# @partygame/client-utils

Browser- and Node-safe client helpers: room-code resolution, share links, waiting and argument bounds. No `node:` imports, no Colyseus.

| Import | What |
|---|---|
| `@partygame/client-utils` | `waitFor`, `resolveRoomCode`, `joinUrl`, `tvUrl`, `between`, type `Parsed` |

## Resolve a room code

```ts
import { resolveRoomCode } from "@partygame/client-utils";

const roomId = await resolveRoomCode("http://192.168.1.5:3001", "ABCD"); // GET /api/resolve-code
```

`joinUrl(base, code)` and `tvUrl(base, code)` build the links a host shares; `waitFor(predicate, what, timeoutMs, stepMs?)` polls until the predicate holds; `between(value, min, max)` validates an integer argument.

Depends on: `@partygame/shared`
