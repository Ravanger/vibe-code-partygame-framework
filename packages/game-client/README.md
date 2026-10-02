# @partygame/game-client

Svelte 5 SDK: connect to a game, manage state, send actions. No game-specific code.

| Import | What |
|---|---|
| `@partygame/game-client` | `GameConnectionManager<TState>`: connect, sync, send actions; `Countdown`, `resolveEndpoints`, `readCodeParam` |
| `@partygame/game-client/testing` | `StubRoom`, `connectedClient`, `fakeFetch` for UI tests without a server |
| `@partygame/game-client/test-setup` | jsdom setup (shims storage, fixes WebSocket for the SDK) |

## Create the manager

One manager per app. `storagePrefix` namespaces the browser storage; `rootSchema` is your state class (import it from a browser-safe `state.ts`).

```ts
import { GameConnectionManager, resolveEndpoints } from "@partygame/game-client";

const { endpoint, apiPort } = resolveEndpoints({}, window.location.hostname); // host:2567 and API 3001
export const manager = new GameConnectionManager<ButtonState>({
  endpoint,
  roomName: "button",        // as registered on the server
  apiPort,
  storagePrefix: "button",
  rootSchema: ButtonState,
});
void manager.resume();       // page load: stored token, then stored room code
```

`resolveEndpoints(overrides, pageHost)` takes string overrides `{ host?, gamePort?, apiPort? }` (for example from `VITE_*` env vars), so a phone on `http://192.168.1.50:5173` talks to `192.168.1.50:2567`.

## Join a room

```ts
await manager.create();                  // new room, you are the host; optional create options
await manager.join("ABCD");              // by 4-letter code; throws with the server's reason
await manager.joinAsSpectator("ABCD");   // TV display, no seat
manager.setName("Ada");                  // readies the seat
await manager.leave();                   // forgets the room
```

```ts
import { readCodeParam } from "@partygame/game-client";

readCodeParam(window.location.search, "code"); // "ABCD" from ?code=abcd, else undefined
readCodeParam(window.location.search, "tv");
```

## Read state reactively

`status` (`"idle" | "connecting" | "connected" | "reconnecting" | "disconnected"`), `state`, `playerId`, `roomCode`, `isHost`, `isSpectator` and `me()` are reactive: reading them in `$derived`, `$effect` or a template re-runs on every patch.

```svelte
<script lang="ts">
  import { manager } from "./manager.js";

  const winner = $derived(manager.state?.winner ?? "");
  const isMe = $derived(manager.me()?.id === winner);
</script>

<p>{manager.status === "reconnecting" ? "Reconnecting..." : winner}</p>
```

Do not `$derived` a schema instance itself (`state.items[i]`): Colyseus mutates it in place, so readers never re-run. Derive primitives or fresh snapshots instead.

## Send actions

`sendAction` resolves with an `ActionResult` and never throws; transport failures come back as `{ ok: false, error: { code: "INTERNAL", ... } }`. Rejections also land in `lastServerError` for a toast.

```ts
const result = await manager.sendAction("PRESS");
if (!result.ok) console.warn(result.error.message);

manager.lastServerError; // { code, message, action? } | undefined
manager.dismissError();
manager.onMessage("FIRST", (payload) => { /* pushed by ctx.send; returns an unsubscribe */ });
```

## Show the phase clock

`countdown()` counts down to `state.phaseEndsAt`, corrected for client clock skew. Call `destroy()` when done.

```ts
const clock = manager.countdown();
clock.secondsLeft; clock.isUrgent; clock.isExpired; // reactive
clock.destroy();
```

## Test UI without a server

`connectedClient` builds a manager attached to a `StubRoom` around a real state object (`setup(state)` fills it first). Mutate the state, then `patch()` as Colyseus would. Add `"@partygame/game-client/test-setup"` to the vitest `setupFiles` (the `@partygame/config` UI preset does).

```ts
import { addSeat, connectedClient } from "@partygame/game-client/testing";

const c = connectedClient({
  stateClass: ButtonState,
  seat: { role: "host", name: "Ann" },
  phase: "Round",
});
addSeat(c.state, "other");
c.state.winner = "other";
c.patch();
await c.manager.sendAction("PRESS");
c.room.requests; // what the UI sent
```

`fakeFetch({ roomId })` stands in for the code API; `StubRoom` also has `push`, `dropConnection`, `reconnected` and `closed`.

Depends on: `@partygame/shared`, `@colyseus/sdk`, `svelte`

Guide: [docs/framework/README.md#client-sdk](../../docs/framework/README.md#client-sdk)
