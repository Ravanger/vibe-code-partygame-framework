# @partygame/game-client

Svelte 5 SDK: connect to a game, manage state, send actions. No game-specific code.

Ships source (`.ts`/`.svelte.ts`); consumers need the Svelte plugin — Vite with `@sveltejs/vite-plugin-svelte`, or the vitest preset that aliases to source.

| Import | What |
|---|---|
| `@partygame/game-client` | `GameConnectionManager<TState>`: connect, sync, send actions; `Countdown`, `resolveEndpoints`, `readCodeParam`; `ClientStrings`, `defaultClientStrings` for the manager's `strings` option |
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

Every client-owned message is replaceable through the `strings` option: pass a partial `ClientStrings` table (defaults in `defaultClientStrings`) — the room-code validation text, the `NOT_CONNECTED`, `INVALID_ACTION`, `BAD_REPLY`, `CONNECTION_LOST`, `ROOM_NOT_FOUND` errors, and the two state-sync rejection messages (`syncDisconnected`, `syncTimedOut`). `strings.errors[code]` overrides the text of any code that lands in `lastServerError`; the server's own `message` is used only as a fallback when the table has no entry for the code.

## Join a room

```ts
await manager.create();                  // new room, you are the host; optional create options
await manager.join("ABCD");              // by room code; throws with the server's reason
await manager.join("ABCD", { joinData: { invite: "X" } }); // bounded data for the game's canJoin hook
await manager.joinAsSpectator("ABCD");   // TV display, no seat
manager.setName("Ada");                  // readies the seat
await manager.leave();                   // forgets the room
```

`join` options (`JoinOptions`): `name`, `spectator`, and `joinData` (string/number/boolean values; at most 8 keys, keys up to 32 characters, strings up to 256). `joinData` is sent once per join and never stored or logged by the manager.

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

`sendAction` resolves with an `ActionResult` and never throws; local failures come back as `{ ok: false, error }` with code `NOT_CONNECTED`, `CONNECTION_LOST` or `BAD_REPLY` (the exception goes to the `logger` option, default `console.warn`). Rejections also land in `lastServerError` for a toast, and so does a failed `join`/`create` (`ROOM_NOT_FOUND` for an unknown code, `BAD_REPLY`, else `CONNECTION_LOST`; the exception goes to `logger` and the promise still rejects), and so do refused joins or closes that carry a known close code (4400-4406, 4409, 4500); every message there is a fixed string from `CLIENT_MESSAGES`/`CLOSE_CODES` or the server's own payload — never raw exception text; the manager's own strings are replaceable through the `strings` option (above).

```ts
const result = await manager.sendAction("PRESS");
if (!result.ok) console.warn(result.error.message);

manager.lastServerError; // { code, message, action? } | undefined
manager.dismissError();
manager.onMessage("FIRST", (payload) => { /* pushed by ctx.send; returns an unsubscribe */ });
```

`GameConnectionManager` takes an optional second type argument, `TEvents`: a map of message names to payload types. With it, `onMessage` only accepts declared names and hands the callback a typed payload; without it (the default), any name is accepted with an `unknown` payload.

```ts
const manager = new GameConnectionManager<MyState, { TURN: { id: string } }>();
manager.onMessage("TURN", (turn) => turn.id); // typed; other names are a compile error
```

## Export the replay

`exportReplay()` is the client route to the host-only `EXPORT_REPLAY` request (#19's server child). It resolves with an `ExportReplayResponse` from `@partygame/shared`: the room's replay bundle for the host, or a refusal — the server's well-formed refusal (for example `UNAUTHORIZED` for a non-host) is passed through and remembered in `lastServerError`, while a malformed reply becomes a fixed `BAD_REPLY`. A request that cannot be sent or answered fails locally with `NOT_CONNECTED` (no room) or `CONNECTION_LOST` (the exception goes to the `logger` option, default `console.warn`).

```ts
const response = await manager.exportReplay(); // host: the bundle; non-host: { ok: false, error }
if (response.ok === false) console.warn(manager.lastServerError?.message);
```

## Show the phase clock

`countdown()` counts down to `state.phaseEndsAt`, corrected for client clock skew. It ticks only while something reads it inside a Svelte effect and stops when the last reader goes away — no cleanup needed. `destroy()` is a deprecated no-op kept for existing callers.

```ts
const clock = manager.countdown();
clock.secondsLeft; clock.isUrgent; clock.isExpired; // reactive
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
