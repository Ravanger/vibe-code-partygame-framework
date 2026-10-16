# Party Game Framework: game author guide

You describe a game as data: phases, the actions players may send in each phase, and optional timers.
The framework supplies the lobby, room, roster, reconnection, timers and wire protocol.

Dependency direction: `games/* -> @partygame/server -> @partygame/core -> @partygame/shared`.

Known traps (build, coverage, reconnects, Schema 5): [troubleshooting.md](troubleshooting.md).

**Design:** Six architecture decisions that explain why the framework is shaped this way: [ADRs](../adr/).

## Scaffolding a new game

Start from the built-in template instead of hand-wiring packages:

```sh
bun run new <slug>                     # e.g. bun run new word-war
bun run new <slug> --name "Word War"    # override the display name only
```

This writes a complete, working, fully-tested game to `games/<slug>/` — package config, a small wave-based
ruleset (two phases, `Waving` and `Results`), a Svelte client, a terminal client, bots and one game declaration
(`gamePackage.ts`) whose entry files are one-line stubs over it — then runs `bun install` so it is ready to play. It targets this monorepo only: it finds the repo root by walking
up to the nearest `package.json` whose `workspaces` include `games/*`, and fails with a clear error otherwise.
Then run `bun run launch <slug>` to start the server and dev client; the build step happens automatically. The
command also updates `bun.lock` for the new workspace — commit it together with `games/<slug>/`.

The slug must be kebab-case starting with a letter (`[a-z][a-z0-9]*(-[a-z0-9]+)*`), not a reserved name
(`list`, `launch`, `play`, `bots`, `dev`, `host`, `prod`), and there must be no existing `games/<slug>/`. It
must also not collide with the workspace: `@partygame/<slug>` may not be an existing package name, and
`<slug>`/`<slug>-game` may not be another game's vitest project names.
Every other name is derived from the slug:
package `@partygame/<slug>`, room `<slug>` with dashes as underscores, plus PascalCase, camelCase and a spaced
display name (override the display name with `--name`).

Once it runs, replace the wave ruleset in `games/<slug>/src/` with your own game; the phases, actions, state, UI,
terminal, bots and the declaration are small, self-contained files you can edit. The rest of this guide explains how each piece works.

## Concepts

### Phases
A game is a set of named phases. `Lobby` is reserved and built in. `startPhase` is where `START_GAME` goes.
Each phase may declare `onEnter`, `duration` + `onTimeout`, `onRosterChange` and `actions`.
Move between phases only with `ctx.transition("Name")`; it is queued and applied after the current hook returns.
Transitioning to the current phase re-enters it and restarts its timer.
`ctx.returnToLobby()` calls `onReturnToLobby` and enters `Lobby`.

### Actions
An action is a client message `{ type: "SCREAMING_SNAKE_CASE", ...fields }`.
Declare it in the phase that accepts it: `from` (`"host"` or `"player"`, where `"player"` means any active player including the host),
a zod `payload` schema that validates the whole action object, and a `handler`.
Every rejection is sent only to the sender as `ERROR { code, message, action }`:

| Code | Cause |
|---|---|
| `INVALID_ACTION` | malformed envelope, or payload failed its zod schema |
| `UNKNOWN_ACTION` | no such action in any phase |
| `WRONG_PHASE` | action exists, but not in the current phase |
| `UNAUTHORIZED` | role check failed (for example a guest sent a host action) |
| `NOT_ACTIVE` | the sender is waiting for the next round |
| `CONTENT_REJECTED` | free text failed the room's text filter: an action's declared `textFields` (via `textFilterMiddleware`) or a player name via `SET_NAME`; the message is the filter's fixed per-level reason. A join with a filtered name is refused with close code 4405 instead |
| `NOT_ENOUGH_PLAYERS` | `START_GAME` below `minPlayers` |
| `NOT_ALLOWED` | game rule; use `ctx.reject("NOT_ALLOWED", "why")` in a handler |
| `NAME_TAKEN` | `SET_NAME` with a name another seat already has (compared trimmed and case-insensitively); the seat keeps its name |
| `KICKED` | pushed to a player the host removed, just before the connection closes |
| `INTERNAL` | only ever the answer to a request: a hook threw while handling the action |
| `NOT_CONNECTED`, `CONNECTION_LOST`, `BAD_REPLY`, `ROOM_NOT_FOUND` | client-side only, never sent by the server: no room joined, the request or connect failed in transit, the reply was not an `ActionResult`, the typed room code is unknown ("Game code not found") |

#### Awaiting an action's outcome
`room.send("ACTION", action)` is fire-and-forget; rejections arrive as `ERROR` pushes.
`room.request("ACTION", action)` additionally resolves with an `ActionResult` (from `@partygame/shared`): `{ ok: true }` or `{ ok: false, error }`
where `error` is the same `ServerError` that was pushed (the first rejection if the handler rejected several times).
`runtime.dispatch(playerId, raw)` returns that first rejection (or `undefined`), so a host can build the answer.

```ts
const result = await room.request<unknown, ActionResult>(ClientMessage.ACTION, { type: "PRESS" });
if (!result.ok) showToast(result.error.message);
```

### Synced state vs private state
`ctx.state` is synced to every client (a Colyseus schema in production). It always has `phase`, `phaseEndsAt`
(epoch ms, `0` when the phase has no timer) and `canStart` (true in the Lobby while `START_GAME` would be accepted). `ctx.priv` is server-only: put secrets there (who wrote what, who voted for whom).
Per-player private data (a hand of cards, your own prompts) belongs in `state`, in a part tagged `.view()`,
and is revealed with `ctx.showTo(playerId, ref)` / `ctx.hideFrom(playerId, ref)`. Prefer this over sending messages:
clients stay reactive and the server re-applies the views when a player reconnects.
`ctx.send` / `ctx.broadcast` are for one-off events.

### Players are keyed by `playerId`
A stable client-generated id, persisted by the client. Use it for every map you keep (`priv`, scores).
`sessionId` is a server detail you never see. `ctx.players()` returns every seat, `ctx.activePlayers()` the connected,
ready, active ones, and `ctx.player(id)` one seat.

### Spectators
`PlayerInfo` and every `ctx.players()` list cover seated players only. Spectators (join option `spectator: true`) never count
towards `minPlayers`, `maxPlayers` or auto-start.

### Host controls
The runtime handles these host-only actions for you; do not declare them (`defineGame` rejects the names):

- `START_GAME` (Lobby), see Lobby below.
- `KICK_PLAYER { playerId }`: any phase, not yourself. The host implementation removes the seat, then `onRosterChange` runs. The ban is per `playerId`: a client that regenerates its id can rejoin.
- `SET_OPTIONS { ...partial }`: Lobby only. If the game declares no `definition.options` schema, it rejects any key but `type` (`INVALID_ACTION`); a room for such a game also refuses create options. Otherwise the partial is merged into the current options and validated, then published; a failed parse or a result whose JSON is longer than `MAX_OPTIONS_JSON_LENGTH` is `INVALID_ACTION` and keeps the previous options. `ctx.options` reflects the new value.
- `END_GAME`: any phase but the Lobby (`WRONG_PHASE` there). It runs `onEndGame(ctx)`, where a game can set a notice for the players, and then returns everyone to the Lobby as `ctx.returnToLobby()` does (`onReturnToLobby` runs, waiting joiners are let in). The hook cannot veto it.

### Roster changes and mid-game joiners
Joins, leaves, disconnects, reconnects and ready changes call the current phase's `onRosterChange(ctx)`.
Use it to re-check completion ("everyone has answered") so a leaver cannot stall the game.
Someone who joins mid-game is seated but not active, so they spectate and their actions get `NOT_ACTIVE`.
Call `ctx.activateWaitingPlayers()` at a natural break in your game to let them in. It activates only ready seats (seats that have set a name);
an unnamed seat stays waiting, and in the Lobby a seat that sets its name is activated at once.
A seat that joined the Lobby is active, but when the game leaves the Lobby (`START_GAME` or auto-start) every seat that is still unnamed is benched (`RuntimeHost.benchUnreadyPlayers`) and waits for the next activation.
After a player reconnects, `onPlayerSync(ctx, playerId)` runs so you can resend their private messages.

### Timers
`duration` is milliseconds, or a function of the context. The timer restarts on every entry (including re-entry).
`onTimeout` is required whenever `duration` is set, fires once, and never fires after the phase was left.
The server owns the clock: clients render a countdown from `phaseEndsAt`.

### Lobby
Built in. `START_GAME` is host only and needs `minPlayers` active players (else `NOT_ENOUGH_PLAYERS`).
Clients read `state.canStart` instead of recomputing that rule.
Set `autoStart: true` on the definition (default `false`) to also start once every seated player is ready and there are at least `minPlayers`.
Returning to the Lobby activates every waiting (mid-game) joiner.

### Phase middleware
Game-level middleware registered on `defineGame` runs around every phase's `onEnter`, `onTimeout`, `onRosterChange` and
around every action handler (including the built-in lobby actions), and observes transitions. It is Koa-style onion
middleware: the first entry in the array is outermost, each layer calls `next()` to reach the next one, and chains are
synchronous in v1 — `PhaseMiddleware` returns `undefined`, so an `async` layer is a compile error (the runtime still
rejects a thenable return value from untyped callers).

```ts
const log: string[] = [];

export const ButtonGame = defineGame<State, Priv>({
  name: "FirstToPress",
  version: "1",
  // ...phases as in Minimal game
  middleware: [
    (ctx, next) => { log.push(`outer ${ctx.event.kind}`); next(); }, // first registered is outermost
    (ctx, next) => { if (ctx.event.kind === "enter") next(); },      // omitting next() skips the hook
  ],
});
```

Every call receives `ctx`, the usual context plus a `readonly event`:

| `event.kind` | When | Extra fields |
|---|---|---|
| `enter` | around each phase's `onEnter` | — |
| `timeout` | around each phase's `onTimeout` | — |
| `roster-change` | around each phase's `onRosterChange` | — |
| `action` | around each action handler, built-ins included | `actionType`, `senderId`, `payload` (zod-parsed), `textFields?` (the action definition's declared text fields), `filterLevel` (the room's current level, default `"off"`) |
| `transition` | after the source hook's chain unwinds, just before the target's `onEnter` chain runs | `from`, `to` |

Semantics:

1. Hooks and handlers run inside the middleware chain. `next()` invokes the inner layer (the next middleware, or the hook/handler itself); omitting `next()` skips the hook/handler — allowed and documented. Calling `next()` twice for one event throws (`middleware[i] called next() twice for one <kind> event`) instead of double-running the inner layers.
2. Transitions stay queued: `ctx.transition("X")` called inside a hook or middleware still applies only after the outermost hook returns, exactly as without middleware. Middleware cannot apply a transition synchronously.
3. Transition observation is an event (`{ from, to }`), not a wrapped `ctx.transition`. The event fires only after the source chain has fully unwound. It also covers `returnToLobby` (`to: "Lobby"`) and re-entering the current phase (`from === to`).
4. Errors: a middleware throw is handled exactly like a hook throw today — on the action path the sender gets `INTERNAL`; enter/timeout/roster paths follow the existing hook-failure path; a throw on a `transition` event defers the same way and never cancels the transition it observes. No new error codes.
5. Rejecting: middleware gets `ctx.reject(code, message)` for `action` events (it throws for any other event kind) — the sender gets the `ERROR` with that code and message, and the rejection counts in `rejectionCount`. It does not stop the chain by itself: omit `next()` to keep the handler from running. Middleware still cannot cancel a queued transition.
6. `defineGame` validates at definition time: `middleware` must be an array of functions, otherwise the problem is listed in the `GameDefinitionError`. Reserved action names are unchanged.
7. Ordering: for `enter`, the outermost middleware runs first; a transition event fires only after the full chain unwinds (consistent with queued transitions).
8. The built-in lobby hooks run through the same wrapped path — middleware applies to `Lobby` too.

Non-goals in v1: no async/await inside the chain (synchronous; a middleware that returns a Promise throws
`middleware[i] returned a Promise; the middleware chain is synchronous` on the first event — do fire-and-forget work
outside the chain), no cancelling queued transitions.

#### Built-ins
- `loggingMiddleware({ log })` — one line per event, no hardcoded console. Exact formats: `enter <phase>`, `timeout <phase>`, `action <ACTION_TYPE> by <senderId> in <phase>`, `transition <from> -> <to>`. No line for `roster-change`.
- `timingMiddleware()` — records per-phase durations into a store kept outside `ctx.priv` (keyed by it; read back with `getPhaseTimings(priv)`); each phase gets `{ enteredAt: number, durationsMs: number[] }`. Started on enter (before the hook), closed when a transition out of that phase is observed. The currently open phase has no final duration yet. Never touches `ctx.state` (it is synced to clients) or `ctx.priv`; timing metadata stays server-side.
- `actionLogMiddleware()` — append-only, JSON-serializable record of every middleware-visible event, kept outside `ctx.priv` (read back with `getActionLog(priv)`); see Action log and replay below.
- `textFilterMiddleware(filter)` — rejects an action whose declared text fields fail the room's filter level. Declare which payload fields are free text per action (`textFields: ["..."]` on the action definition; the framework never guesses) and how strict this room is via `filterLevel?: (options) => "off" | "moderate" | "strict"` on the game definition (default `"off"`). For each declared string field it runs `filter.check(value, level)` in declaration order and, on the first failure, rejects with `CONTENT_REJECTED` and the filter's reason without running the handler. A `TextFilter` comes from `@partygame/content` (`createTextFilter()` is the default English one); at `"off"` the filter is never called, and actions without `textFields` pass untouched.

### Action log and replay
`actionLogMiddleware()` records everything the middleware sees into an append-only, JSON-serializable log
kept alongside `ctx.priv` — a server-side record of the whole room session. Register it like any other
middleware; unregistered games pay nothing (the chain early-returns on an empty array).

```ts
import { actionLogMiddleware, getActionLog } from "@partygame/core";

export const ButtonGame = defineGame<State, Priv>({
  // ...phases as in Minimal game
  middleware: [actionLogMiddleware()],
});
```

The log is created lazily on the first event and kept in a module-level store keyed by the private-state
object (the same pattern as `timingMiddleware`, read back with `getPhaseTimings(priv)`), so framework data
never collides with a game's own private fields and a frozen or sealed private state works unchanged. It
never touches `ctx.state`; export it with `JSON.stringify(getActionLog(priv))`. Because the store is keyed
by the object, `createPrivateState()` must return a fresh object on every call: the `GameRuntime` constructor throws
`InvalidPrivateStateError` for a primitive or `null`, but a shared object (`() => SHARED`) is not detected and makes
every room and replay table append to one log and one timing store.

**Header** — written on the first entry:

| Field | Meaning |
|---|---|
| `seed` | Room RNG `Seed`, four unsigned 32-bit numbers (see Determinism contract) |
| `game` | Definition name; `replayLog` refuses a log recorded for another game |
| `version` | Definition version; `replayLog` refuses a log recorded for another version, or one without it (recorded before versioning) |
| `startedAt` | `ctx.now()` at the first entry (the construction-time Lobby enter) |

**Entries** — one per middleware-visible event, in append order:

| Field | Meaning |
|---|---|
| `seq` | 1-based, strictly increasing |
| `t` | `ctx.now()` at record time |
| `phase` | Current phase; for `enter`, the phase being entered |
| `kind` | `"action" \| "transition" \| "enter" \| "timeout" \| "roster-change"` |
| `actionType`, `senderId`, `payload` | `kind === "action"` only; `payload` is the zod-parsed action object |
| `rejected` | `kind === "action"` only; `true` when the handler called `ctx.reject()` or threw a `FrameworkError` (the action ran but changed nothing). Absent on accepted actions |
| `from`, `to` | `kind === "transition"` only |

Actions rejected **before the handler chain** — malformed envelope, unknown action, unauthorized sender,
inactive player, invalid payload — are **not** logged: they never reach the middleware and change no state.
An action whose *handler* calls `ctx.reject()` or throws a `FrameworkError` (as the built-in `START_GAME` does with too few players) has reached the chain and **is** logged, marked
`rejected: true`; it changes no state either, and such logs replay — the re-dispatch re-runs the handler
(RNG draws included) and must reject again (a mismatch in either direction throws). Roster changes are
recorded for observability (see the replay limitation below).

**Roster.** When `START_GAME` is dispatched, the middleware also records `log.roster` — the seats in
seat order at start time, each as `{ id, isConnected, isReady, isActive }`, captured once (a second
start after `returnToLobby` does not overwrite it). Lobby-only sessions have no roster. This is what
makes logs from real rooms replayable: replay pre-seats exactly these seats — restoring the recorded
flags, so the bench-on-start and every `activePlayers()` read match live — and maps their ids
positionally to `p1..pN`, so every recorded sender re-dispatches against the matching replay seat
(the live host is always the first seat, and the replay table's first seat is its host).

**Determinism contract.** A log replays exactly when its three non-determinism sources are controlled:

- **RNG.** Rooms draw their randomness from `sfc32`, a PRNG with 128 bits of state; each room gets a
  `Seed` (four unsigned 32-bit numbers) from `crypto.getRandomValues` at creation, recorded in the header,
  so published ids do not reveal the stream. `FakeHost`/`TestTable` accept a `Seed` or a number (expanded
  by `seedFromNumber`); an unseeded host is `seedFromNumber(0)`, so even unseeded test rooms are
  replayable by seed (and their ids from `ctx.newId()` stay unique).
- **Clock.** Replay scripts the fake clock: it advances to each entry's `t` before applying the entry, and
  logged timeouts are authoritative — when replay enters a timed phase, its timer is made to expire at the
  time recorded in the log. A live room's phase timers run on Colyseus's tick-quantized clock (a ~17 ms
  grid), so a timeout can fire a few ms early or late relative to enter + duration; `phaseEndsAt` in
  replayed snapshots is the logged timeout time, not enter + duration.
- **IDs.** Identifiers that land in synced state or an action payload must come from `ctx.newId()` (drawn
  from the room RNG). `crypto.randomUUID()` breaks replay: re-dispatched payloads reference ids the fresh
  runtime never generated.

**Replay.** `replayLog(definition, log, init)` (from `@partygame/core/testing` — it builds a `TestTable`)
re-drives a fresh runtime — same definition, RNG seeded from
the header, clock starting at `header.startedAt`, the recorded roster pre-seated with its flags restored
(`p1..pN` mapped positionally; for logs without a roster, `init.players` pre-seats that many seats instead)
— dispatching every logged action in order:

```ts
import { replayLog } from "@partygame/core/testing";

const { states } = replayLog(ButtonGame, log, {
  state: new State(), // same shape as passed to TestTable
  options: {},
  // players is only needed for logs without a recorded roster (lobby-only sessions)
  // seed defaults to log.header.seed
});
```

`states[0]` is the fresh construction at `header.startedAt`, before any entry; each following element is
one deep-cloned snapshot per step — every logged `action`, `timeout` or (skipped) lobby `roster-change`
starts a step, and the transitions and enters that follow from it belong to the same step. It throws when
the log's shape is malformed — validated up front with named errors: `entries` not an array, an entry
that is not an object or lacks a known `kind`, numeric `t` and `seq` and a string `phase`, `header`
missing or lacking a string `game`, a four-number `seed` and number `startedAt`, or a roster entry missing its
`id`/flags — when the first entry is not the construction-time Lobby enter (every recorded session starts
with it), when the log's `game` does not match the definition, when its `version` differs from the
definition's or is absent (a log predating versioning), on a mid-game roster change, on out-of-order
entry times,
when a re-dispatch rejects an action the log records as accepted or accepts one recorded with
`rejected: true` (a mismatch in either direction means the log is not what this definition produces), or
when a logged transition or enter contradicts what the replayed runtime actually did — each step asserts
its own consequence run, so a tampered log throws naming the mismatch.

**Limitations in v1.** Mid-game roster changes are not replayed: `replayLog` throws naming the first such
entry. Lobby-phase roster changes are skipped — the recorded roster is pre-seated at construction — so a
game whose `Lobby.onRosterChange` writes synced state may diverge in intermediate states for sessions with
lobby joins/leaves (final states still match). A sender that is not in the recorded roster (for example a
joiner of a second session after `returnToLobby`) makes the re-dispatch throw. A log that contains a failed run
(a hook threw and the failure policy returned the room to the Lobby: a transition to the Lobby with no
`returnToLobby` behind it) is not replayable: the re-dispatch fails the same way, and `replayLog` throws
`replayLog: entry N re-ran into a failed run (...)`. No log cap; party sessions
are minutes long.

**Compatibility.** Replay re-runs the definition's handlers and hooks against the recorded events, so a log
is guaranteed to replay only against the definition that recorded it. Some staleness `replayLog` detects
outright with a named error (shape, game/version mismatch, ordering, phase and accept/reject divergence);
other changes replay "successfully" into different state values — the walk asserts phases and action
outcomes, never state contents.

| Change | Breaks replay? | Why |
|---|---|---|
| Handler or hook logic change | Yes | Handlers and hooks re-run; changed logic writes different state (and may draw a different number of RNG values — see below) |
| Added or removed `ctx.rng()` draw | Yes | The seeded stream is positional: one extra or missing draw shifts every later draw, including `newId` ids, for the rest of the replay |
| Changed phase `duration` | Yes, when the new deadline falls before a logged event | Logged timeouts stay authoritative (they keep their recorded times), but a replayed timer that beats the log produces a timeout the log does not have — the per-step phase assertion throws |
| Changed option schema defaults | Yes, unless the same options are passed to `replayLog` | The log records no options; the replayed runtime sees `init.options`, so a changed default re-runs handlers with different inputs |
| Renamed action or phase | Yes | The log stores names as strings: a renamed action fails its re-dispatch, and a renamed phase contradicts the logged transitions/enters — both throw |
| New unrelated phase | No | Replay only walks recorded events; a phase that never appears in the log is never entered |
| Changed UI only | No | The client renders synced state and sends actions; it contributes no logic to the server-side replay |
| Framework upgrade that changes `GameRuntime` ordering | Yes | Replay runs on the current framework's runtime (transition queue, middleware chain, built-in lobby behavior); if the order of effects changed since recording, the log's consequences no longer match — the step assertions throw, or state diverges |

**What is recorded to detect it.** `header.game` (the definition name) and `header.version` (a free-form
string the game author bumps; compared by exact equality). The header seed is recorded too, but to reseed
the runtime, not to compare. Planned: protocol/framework version negotiation (#77); it changes nothing above until it ships.

**Old logs.** A mismatch surfaces as a named `replayLog:` error — or, for changes that only alter state
values, as a replay that completes with different states. No migration exists: a log without
`header.version` (recorded before versioning) is refused outright. The recommended practice is to keep the
game at the recorded name and version to replay its log — bump `version` whenever you change anything the
table above marks "yes".

**Runtime additions.** Action middleware events now carry the zod-parsed `payload`; every context exposes
`ctx.gameName` (definition name), `ctx.gameVersion` (definition version, recorded in the log header),
`ctx.seed` (room RNG seed, recorded in the log header) and `ctx.newId()` (deterministic ids — see the
Determinism contract above). Middleware contexts additionally expose `ctx.rejectionCount` — the live count
of rejections (`ctx.reject()` calls and a handler-thrown `FrameworkError`) for the current dispatch, so a middleware can tell after `next()` whether an action's
handler rejected.

### Errors at definition time
`defineGame` throws `GameDefinitionError` listing every problem: empty `name` or `version`, reserved or unknown
phase names, missing `startPhase`, `duration` without `onTimeout`, bad player limits, bad action names.
A `ctx.transition()` to an undeclared phase throws at the call site.

### Errors at runtime
A throwing `onEnter`, `onTimeout`, `onRosterChange`, action handler, middleware or timer callback cannot wedge the room.
The runtime collects every failure of one run and hands them to `definition.onError(ctx, error)` — the single error when
one failed, an `AggregateError` in original order when several did. A throwing `onError` is caught; its failure joins the
rethrow below instead of recursing into `onError` again.
By default (no `onError`, or one that queues no transition) the runtime applies a fixed policy: it sets `state.notice` to
a short fixed message and returns the room to the Lobby — notice only when already there — so the host can start again.
That return is an ordinary transition to middleware (one `transition` event, so the action log and `timingMiddleware`
see it), and `START_GAME` clears `state.notice` when the next game starts.
If `onError` queues its own way out with `ctx.transition()` or `ctx.returnToLobby()`, that runs instead of the default policy.
The run still rethrows what it reported, so the server logs the failure and a failed action answers `INTERNAL`;
a throwing hook never leaves the room mid-phase.
That covers a phase loop (more than 100 chained transitions, including one queued by `onError`), a throwing
`onReturnToLobby` (it runs once, not again by the policy), and a failure while the room is constructed: the initial
Lobby enter is reported to `onError` at construction and does not throw out of it, so the next action is not charged for it.
A `FrameworkError` is exempt only inside an action (below); from `onRosterChange`, `onPlayerSync` or `onTimeout` it is
an ordinary hook failure.

### Error model
Client-visible error strings are fixed and table-driven; raw Zod or exception text never reaches a client.

- Internally, core and server throw `FrameworkError(code, message)` from `@partygame/shared`. Its `message` is for
  server logs and the action log only — clients never see it.
- A `FrameworkError` thrown anywhere in a dispatch (a pipeline check or an action handler) is mapped to
  `{ code, CLIENT_MESSAGES[code] }` for both the pushed `ERROR` and the action's answer, and the room stays in its
  phase: no failure policy, no return to the Lobby. A non-`FrameworkError` throw still goes through the failure
  policy above and answers `INTERNAL`.
- Join/create refusals close the connection with a `CLOSE_CODES` number; the client sees the entry's fixed message:

  | Close code | Name | `ErrorCode` | Client message |
  |---|---|---|---|
  | 4400 | `INVALID_OPTIONS` | `INVALID_ACTION` | Invalid room options |
  | 4401 | `ROOM_FULL` | `NOT_ALLOWED` | Room is full |
  | 4402 | `SEAT_REMOVED` | `KICKED` | Your seat was removed |
  | 4403 | `KICKED_REJOIN` | `KICKED` | Removed by the host |
  | 4404 | `WATCH_ONLY` | `NOT_ALLOWED` | This room is watch-only |
  | 4500 | `INTERNAL` | `INTERNAL` | The server could not handle the request |

- Invalid create or join options are `safeParse`d and refused with the close code above, so a bad option never
  surfaces Zod text; the issues are logged server-side with `logger.warn`. An unexpected throw while creating a room
  or joining one (a failing room code service, state constructor or other bug) is logged with `logger.error` and
  closes with `4500`, never with the exception text. Hook failures reach clients only as `INTERNAL` plus the fixed failure notice.
- `ctx.reject(code, message)` is the one game-authored exception: your message is passed through to the client.
  Keep it short and player-facing; the code still comes from `ErrorCode`.
- The client keeps one `lastServerError` (`GameConnectionManager.lastServerError`): server `ERROR` payloads,
  failed action answers, refused joins (looked up by close code), a failed `join`/`create` (`ROOM_NOT_FOUND`, `BAD_REPLY` or `CONNECTION_LOST`; the exception goes to the `logger` option and the promise still rejects) and a fixed `NOT_CONNECTED`, `CONNECTION_LOST` or `BAD_REPLY` message for local action failures (the exception goes to the manager's `logger` option, default `console.warn`).
  The welcome screen moves a failed join's message into its own error line and clears the toast, so exactly one renders.
  `ServerError.action` is set only by `ctx.reject` and invalid-payload rejections; framework rejections omit it.
  Clear it with `dismissError()`.

`CLIENT_MESSAGES` holds the fixed string per `ErrorCode`; `closeCodeEntry(code)` looks up a close-code entry by
number. Both live in `packages/shared/src/errors.ts`, the single source for the table above.

## Minimal game: first to press the button

```ts
import { actionFactory, defineGame } from "@partygame/core";
import { z } from "zod";

interface State { phase: string; phaseEndsAt: number; canStart: boolean; winner: string }
interface Priv { presses: string[] }

const action = actionFactory<State, Priv, Record<string, unknown>>();

export const ButtonGame = defineGame<State, Priv>({
  name: "FirstToPress",
  version: "1",
  minPlayers: 2,
  maxPlayers: 8,
  startPhase: "Round",
  createPrivateState: () => ({ presses: [] }),
  phases: {
    Round: {
      duration: 10_000,
      onEnter: (ctx) => { ctx.activateWaitingPlayers(); ctx.priv.presses = []; ctx.state.winner = ""; },
      onTimeout: (ctx) => ctx.transition("Done"),
      actions: {
        PRESS: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.priv.presses.push(ctx.playerId);
            ctx.state.winner = ctx.priv.presses[0] ?? "";
            ctx.transition("Done");
          },
        }),
      },
    },
    Done: {
      duration: 3_000,
      onTimeout: (ctx) => ctx.returnToLobby(),
    },
  },
});
```

## Running it

Core is pure; a host drives it:

```ts
const runtime = new GameRuntime({ definition: ButtonGame, state, options: {}, host });
runtime.dispatch(playerId, rawAction);   // client ACTION message; returns the first ServerError rejection, if any
runtime.rosterChanged();                 // after any seat/connection/ready change
runtime.syncPlayer(playerId);            // after a (re)connect
runtime.stop();                          // on room dispose: clears timers
```

`options` are the room options, already parsed with `definition.options` (the host does this once, before building the runtime).
`host` is a `RuntimeHost`: seat list, `send`, `broadcast`, `showTo`/`hideFrom`, `kick`, `publishOptions`, `now`, `rng`,
`activateWaitingPlayers`, and `setTimeout`/`clearTimeout` (the runtime's XState actor uses these as its clock).
The Colyseus server implements it; tests use `FakeHost` from `@partygame/core/testing`.

### Unit-testing phases without a server
`FakeHost` is a `RuntimeHost` with a manual clock, so phase rules are tested fast and deterministically against your real state schema:

```ts
import { GameRuntime } from "@partygame/core";
import { FakeHost } from "@partygame/core/testing";

const host = new FakeHost();
host.seat("p1"); host.seat("p2");                        // first seat is the host; all ready and active
const runtime = new GameRuntime({ definition: ButtonGame, state: new ButtonState(), options: {}, host });
runtime.dispatch("p1", { type: "START_GAME" });           // the host starts the game
runtime.dispatch("p1", { type: "PRESS" });
host.advance(3_000);                                      // fires due phase timers
host.errorsTo("p1");                                      // rejections the player received
host.views, host.sent, host.broadcasts, host.kicked, host.published   // everything the host was asked to do
host.rng = () => 0.99;                                    // steer random choices
```

`TestTable` wraps that setup (seats `p1..pN`, the real runtime, a manual clock). Extend it with your game's scenario steps:

```ts
import { TestTable } from "@partygame/core/testing";

class ButtonTable extends TestTable<ButtonState, ButtonPrivate, ButtonOptions> {
  constructor(players = 3) {
    super({ definition: ButtonGame, state: new ButtonState(), options: {}, players });
  }

  everyonePresses(): void {
    for (const id of this.ids()) this.act(id, "PRESS");
  }
}

const table = new ButtonTable();
table.start();                       // p1 sends START_GAME; returns the ServerError if refused
table.everyonePresses();
table.act("p9", "PRESS");            // returns the refusal, or undefined
table.errors("p1");                  // every ERROR p1 received
table.tick(3_000);                   // advances the manual clock
table.drop("p2"); table.rejoin("p2"); table.leave("p3"); table.joinLate("p5");
table.phase; table.priv; table.state; table.host;
```

### Structuring a bigger game
Keep each phase in its own file exporting a `PhaseDefinition`, and let `defineGame` only assemble them. Put decisions that need no
context (pairing, scoring, eligibility, tallies) in pure functions that take plain data and the rng, so they are testable
without the runtime; phases are thin glue that reads the context, calls them, and writes the state. Export phase and action
names from constants so server and UI share them, and build actions with `actionFactory<State, Private, Options>()` once per
game so each handler's `payload` is inferred from its zod schema. `games/wit-clash/src` is the worked example.

Scores live in a `Record<playerId, number>` mutated only through `awardPoints(scores, playerId, points)`. `leaderboard(scores)` lists them best first (ties by `playerId`). `composeLeaderboard({ scores, seatedNames, rememberedNames, ids? })` returns `{ playerId, name, score, hasLeft }` for everyone in `ids` and `scores` (missing scores are 0): seated players first, then leavers, each group best first; the name comes from `seatedNames`, else `rememberedNames`, else `""`. Extend each entry with your own columns for the state the clients render.

## Server

`@partygame/server` hosts any game on Colyseus. Your state class extends `BaseGameState` (`phase`, `phaseEndsAt`, `roomCode`,
`serverNow`, `spectatorCount`, `options` as JSON, `notice` (a message for the room, e.g. why it is back in the lobby; games write it in `onEndGame`/`onReturnToLobby`, and the runtime sets a fixed one when a hook throws and clears it when `START_GAME` begins the next game — see "Errors at runtime"), `minPlayers`, `maxPlayers`, `players` keyed by `playerId`).
State uses `@colyseus/schema` 5's decorator-free `schema()`; no compiler flags are needed:

```ts
import { type SchemaType, schema, t } from "@colyseus/schema";

const SecretSchema = schema({ word: t.string().default("") }, "SecretSchema");

const ButtonState = BaseGameState.extend({
  winner: t.string().default(""),
  secrets: t.map(SecretSchema).view(),       // per-player, see below
}, "ButtonState");
type ButtonState = SchemaType<typeof ButtonState>;

const games = [{ roomName: "button", definition: ButtonGame, stateClass: ButtonState }];
```

Bun entry point (the only place that imports `bun`):

```ts
import { startServer } from "@partygame/server/bun";
await startServer({ games });   // WebSocket on PORT (2567) + /api/resolve-code on API_PORT (3001)
```

Elsewhere: `createGameServer({ games, roomCodeService?, transport?, reconnectMs?, emptyRoomGraceMs?, textFilter? })` returns the Colyseus `Server`,
and `createApiHandler(roomCodeService)` is the pure `(Request) => Response` behind `/api/resolve-code`.

Clients join with `{ playerId, name? }` (`spectator: true` for a TV display: no seat, counted in `spectatorCount`).
Create a watch-only room with the framework option `seats: string[]` (the playerIds allowed to take a seat): any other non-spectator join is refused with `4404 "This room is watch-only"`, spectators still join. It is not a game option and is not published in `state.options`.
`SET_NAME` readies a seat (a name another seat has is refused with `NAME_TAKEN`; a join-time `name` that is taken is ignored and the seat joins unnamed). With a `textFilter` on `createGameServer`, names are also checked against it at the level of the game's `filterLevel` over the room's current options (default `"off"`): a join with a filtered name is refused with close code 4405 (`CONTENT_REJECTED`) and a `SET_NAME` with one is refused with `CONTENT_REJECTED` and the filter's reason, keeping the old name; a level raised mid-lobby applies to the next `SET_NAME`, not to names already set. A room is kept alive only by connected seats: once the last one is gone for `emptyRoomGraceMs`, the room is disposed and any spectators are disconnected. `ACTION` carries your actions (`room.send` or `room.request`, see Actions). A dropped connection holds the seat for `reconnectMs`
(token reconnect or a new session with the same `playerId`); a mid-game joiner is seated inactive.
When the host leaves or drops, the role moves to a connected seat that is active and ready, else one that is ready, else any connected seat.
Spectators get no reconnection window; they simply rejoin.

### Private state with StateView
Tag a synced field `.view()`, put per-player entries in it, and reveal each with `ctx.showTo(playerId, entry)`;
`ctx.hideFrom` revokes. The room remembers what each player may see and re-applies it on every reconnect, so nothing is resent.
Call `hideFrom` before you delete an entry, or the room will try to re-add it on reconnect.

### Testing a game
```ts
import { bootTestServer, waitUntil, collectMessages, seatPlayers, stateOf } from "@partygame/server/testing";

const t = await bootTestServer({ games });            // free port, default transport, short reconnect window
const room = await t.createRoom("button");            // server-side Room: inspect room.state
const alice = await t.join(room, { playerId: "player-0001" });
alice.send("SET_NAME", "Alice");
alice.send("ACTION", { type: "PRESS" });
await waitUntil(() => room.state.phase === "Done", "finished");
await t.shutdown();                                    // t.cleanup() between tests
```
`t.joinAs(room, { playerId }, ButtonState)` joins with a typed client state. `seatPlayers` joins and names several players
(`player-0001`, from `testPlayerId(n)`) and waits until the server sees each ready; `stateOf` reads the server-side state without a cast:

```ts
const [ann, bob] = await seatPlayers(t, room, { stateClass: ButtonState, count: 2, start: true });
ann.act("PRESS");                                      // ACTION { type: "PRESS" }
await waitUntil(() => stateOf(room, ButtonState).winner === ann.playerId, "winner");
ann.client.state.winner;                               // the client's own typed view
bob.errors;                                            // every well-formed ERROR bob received
```
`joinPlayer(t, room, n, stateClass)` joins one player without a name; `TestPlayer.setName(name?)` readies it.
A runnable example is the fixture in `packages/server/tests/fixtures/buzzer.ts`.

## Client SDK

`@partygame/game-client` is a Svelte 5 SDK with no knowledge of any game. It depends on `@partygame/shared`, `@colyseus/sdk` and `svelte`.

```ts
import { GameConnectionManager } from "@partygame/game-client";

const manager = new GameConnectionManager<ButtonState>({
  endpoint: "http://localhost:2567",   // game server
  roomName: "button",                  // as registered with createGameServer
  apiPort: 3001,                       // /api/resolve-code, default 3001
  storagePrefix: "button",             // browser storage namespace
  rootSchema: ButtonState,             // your state class (browser-safe: see below)
  syncTimeoutMs: 10000,                // optional: give up if the first state takes longer (default 10000)
  logger: console.warn,                // optional: receives the exception behind a local action failure (default console.warn)
});
manager.onMessage("FIRST", (payload) => { /* register pushed messages before connecting */ }); // payload: unknown by default
await manager.resume();                // page load: stored token, then stored room code
await manager.create();                // or: await manager.join("ABCD") / joinAsSpectator("ABCD")
manager.setName("Ada");
const result = await manager.sendAction("PRESS", { power: 3 });
```

| Member | |
|---|---|
| `status` | `"idle" \| "connecting" \| "connected" \| "reconnecting" \| "disconnected"` (`$state`) |
| `playerId` | stable UUID kept in `localStorage` under `${storagePrefix}.playerId` |
| `state` | the room's state, or `undefined` outside a room; reactive (below) |
| `roomCode`, `isHost`, `isSpectator`, `me()` | from `state`; `me()` is your `PlayerSchema` seat (`undefined` for spectators); `isSpectator` is true in a room without a seat |
| `create(opts?)`, `join(code, opts?)`, `joinAsSpectator(code)`, `resume()`, `leave()` | connect and disconnect. `create`/`join`/`resume` resolve once the first state has arrived. `join` throws with the server's reason for an unknown code. The newest connect wins: an older one still in flight rejects with "Connection cancelled", as does one interrupted by `leave()`/`dispose()`. A first state that never arrives rejects with a timeout |
| `setName(name)` | `SET_NAME`; readies the seat |
| `sendAction(type, payload?)` | `Promise<ActionResult>`, see below |
| `lastServerError`, `dismissError()` | last rejected action or pushed `ERROR` (`$state`), for a toast. A kick arrives as `KICKED`, after which `status` is `"disconnected"` |
| `onMessage(type, cb)` | returns an unsubscribe function; survives room changes. Pass a second generic, `GameConnectionManager<State, Events>`, with `Events` mapping message names to payload types, and `type` is limited to those names and `cb` gets the matching payload; the default accepts any name with an `unknown` payload |
| `countdown()` | a `Countdown` (`secondsLeft`, `isUrgent`, `isExpired`) to `phaseEndsAt`, corrected for client clock skew; ticks only while read in a Svelte effect. `destroy()` is a deprecated no-op |
| `dispose()` | stop listening and close without forgetting the session |

### Browser-safe state classes
`BaseGameState` and `PlayerSchema` live in `@partygame/shared/schema` (re-exported by `@partygame/server`). Import them from there in your game's
`state.ts` so the browser bundle never reaches `@colyseus/core`. `@colyseus/schema` is allowed in `shared/schema` and in a game's `state.ts`; `@colyseus/core` only in `server`.

### Reactivity
Reading `manager.state` (or anything reached through it) inside `$derived`, `$effect` or a template re-runs on every patch.
The manager subscribes to `room.onStateChange` while something is reading and unsubscribes when the last reader goes away.
Colyseus mutates schema instances in place, so one trap remains: a `$derived` that returns a schema instance (`$derived(state.matchups[i])`)
is deduplicated by identity and its readers never re-run. Expose plain getters, or derive primitives and fresh snapshots (`[...state.items].map(...)`).

### sendAction results
`sendAction` uses `room.request`, so it resolves with the server's verdict: `{ ok: true }` or `{ ok: false, error }` (`error` is a `ServerError`).
Rejections are also kept in `lastServerError`. A local failure resolves as `{ ok: false, error }` and never throws: `NOT_CONNECTED` (no room), `CONNECTION_LOST`
(the request rejected: timeout, connection closed) or `BAD_REPLY` (not an `ActionResult`). Each has its own fixed `CLIENT_MESSAGES` text;
the exception goes to the `logger` option (default `console.warn`), never to `lastServerError`.

### Reconnects
The Colyseus SDK reconnects by itself after a dropped connection and keeps the `Room`, `room.state` and every schema instance (views included).
The manager shows `status === "reconnecting"` meanwhile and `"connected"` again afterwards; nothing is re-bound. `status` becomes `"disconnected"`
when the server ends the session for good (kick, room closed, retries exhausted). After a page reload call `resume()`: it uses the
reconnection token in `sessionStorage`, then falls back to the room code in `localStorage` (the server reattaches the seat by `playerId`).
A client that joined with `joinAsSpectator` is remembered as a spectator and `resume()` rejoins it as one by code, never as a seated player.
`leave()` forgets the room code, token and spectator flag (a reload does not rejoin) and sets `status` to `"disconnected"`.
Joins are de-duplicated per code and mode, so watching and playing the same room are different joins and the newest wins.

### Testing UI code
`@partygame/game-client/testing` has `StubRoom`, an in-memory room around a real state object. `manager.attach(new StubRoom(state))`, mutate the state,
call `room.patch()`. `room.requests`/`room.sent` record what the UI sent, `room.reply` sets the answer to `request`, and `push`, `dropConnection`,
`reconnected`, `closed` fire server events. `connectedClient` builds the usual fixture in one call, and `fakeFetch` stands in for the network:

```ts
import { addSeat, connectedClient, fakeFetch } from "@partygame/game-client/testing";
import { vi } from "vitest";

const c = connectedClient({
  stateClass: ButtonState,
  seat: { role: "host", name: "Ann" },                 // this client's seat; the name defaults to "Me"
  phase: "Round",                                      // default "Lobby"
  setup: (state) => { state.winner = "p2"; },          // before the manager attaches
});
addSeat(c.state, "other");                              // a ready, active, connected player
c.state.winner = "other"; c.patch();                    // as Colyseus would after a patch
c.manager; c.room; c.me;

const net = fakeFetch({ roomId: "r1" });                // an Error or a string rejects instead
vi.stubGlobal("fetch", net.fetch);
net.urls;                                               // every URL requested
```

Integration tests boot a real server with `bootTestServer` from `@partygame/server/testing`
(`t.endpoint`, and `await t.serveApi()` for the code-resolution API) and use real managers. Add `"@partygame/game-client/test-setup"` to the
vitest `setupFiles`: it shims the storages and makes the SDK use `ws` under jsdom.

## Game UI viewmodels

`@partygame/game-ui` holds the generic client viewmodels (Svelte 5 runes, no components), typed on `GameConnectionManager<TState extends BaseGameState>`. Import it through the `svelte` export condition (Vite with the Svelte plugin), like `game-client`.

| Class | What |
|---|---|
| `NameField` | A text draft that sends `setName` after a pause in typing (`new NameField(manager, debounceMs = 250)`). |
| `GameControlsViewModel` | Leave and host-only end-game menu, visible in every phase except the lobby. |
| `WelcomeViewModel` | The join screen: host, join by room code, watch as a TV, and auto-join from a `?code=` or `?tv=` link (`new WelcomeViewModel(manager, urlCode?, urlTvCode?)`). |
| `LobbySettingsViewModel` | The host's options form, generated from the game's options schema (`OptionFields` builds the fields). |
| `OptionsReader` | The published options, parsed once per state change: `new OptionsReader(manager, schema, defaults?)` exposes reactive `current`, falling back to `defaults` or the schema's `.default()`s. |
| `PhaseClock` | A phase's server countdown plus its configured length: `new PhaseClock(manager, totalSeconds, announceAt?)` exposes `secondsLeft`, `isUrgent`, `announcement` (30/10/5 by default) and your `totalSeconds` getter. |
| `TypingReporter` | One typing message per change: `new TypingReporter(send, idleMs = 2500)`; call `keystroke()` per key and `stop()` on submit or teardown. |
| `AppRouter` | Routes the connection status and room phase to a screen of your screen table (see below). `createAppRouter(manager, screens)` builds one. |
| `WaitingRoomViewModel` | The lobby: seats (`LobbyPlayer`), ready count, host-only start and kick (with confirmation), name field, share URL, copy code, `notice`. An optional second argument `{ location?, clipboard? }` replaces the defaults (`window.location`, `navigator.clipboard`, read lazily) for non-browser hosts and tests. |

The waiting room reads `players`, `minPlayers`, `maxPlayers`, `canStart`, `spectatorCount` and `notice` from `BaseGameState`. A game sets `notice` (for example in `onEndGame` or `onReturnToLobby`) to say why the room is back in the lobby; the runtime also writes a fixed message when a hook throws (see "Errors at runtime") and clears it when the next game starts, and the waiting room shows whatever is there.

The game plugs its rules in through the constructor. `GameControlsViewModel` takes an `isGameOver` predicate (default: never over); the host cannot end a game that is over:

```ts
import { GameControlsViewModel as GameControlsBase } from "@partygame/game-ui";

export class GameControlsViewModel extends GameControlsBase<ButtonState> {
  constructor(manager: GameConnectionManager<ButtonState>) {
    super(manager, (state) => state.phase === "Done");
  }
}
```

`LobbySettingsViewModel` takes the same options schema you pass to `defineGame`, optional `defaults` shown until the server publishes valid options, and optional `labels`. Every bounded numeric option (`.min()` and `.max()`) appears in the form with no UI work; a field is labelled from its camelCase key ("Turn seconds") unless `labels` overrides it:

```ts
import { LobbySettingsViewModel as LobbySettingsBase } from "@partygame/game-ui";

export class LobbySettingsViewModel extends LobbySettingsBase<ButtonState> {
  constructor(manager: GameConnectionManager<ButtonState>) {
    super(manager, {
      schema: ButtonOptionsSchema,
      defaults: { turnSeconds: 20 },
      labels: { turnSeconds: "Seconds per turn" },
    });
  }
}
```

`createAppRouter(manager, screens)` is the app shell's router. `screens` maps each phase name to your component and an optional `banner` (shown for a moment when the room enters the phase). `router.screen` is a `Route`: `welcome` (not connected), `connecting` (a phase missing from the table), `join-next-round` (a seat marked inactive outside the lobby) or `phase`. A client with no seat (the TV) passes through to the phase screen; `reconnecting` keeps the current screen. Also exposed: `screenKey`, `banner`, `phase`, `isSpectator`, `isReconnecting`, `roomCode`, `error` and `dismissError()`.

```svelte
<script lang="ts">
  import { LOBBY_PHASE } from "@partygame/shared";
  import { createAppRouter } from "@partygame/game-ui";
  import Lobby from "./Lobby.svelte";
  import Round from "./Round.svelte";
  import Welcome from "./Welcome.svelte";
  import { manager } from "./manager.js";

  const SCREENS = {
    [LOBBY_PHASE]: { component: Lobby, banner: "" },
    Round: { component: Round, banner: "GO!" },
  } satisfies Record<string, { component: unknown; banner?: string }>;

  const router = createAppRouter(manager, SCREENS);
  const route = $derived(router.screen);
</script>

{#if route.kind === "phase"}
  {@const Screen = SCREENS[route.phase].component}
  <Screen {manager} />
{:else if route.kind === "welcome"}
  <Welcome {manager} />
{:else}
  <p>Connecting...</p>
{/if}
```

To change a rule, subclass it and override a member, for example `banner`: `class AppViewModel extends AppRouter<ButtonState, typeof SCREENS> { override get banner() { ... } }` (`manager` and `screens` are `protected`).

### Components

`@partygame/game-ui/components` ships Svelte 5 source (no build step; import through the `svelte` export condition). `PlayerSticker` and `QrCode` have helpers on the main entry: `playerSticker`, `stickerLetter`, `qrCode`. `Podium` takes steps from `podiumSteps(rankRows(rows))`: `rankRows` adds competition ranks (1, 1, 3) to rows already in leaderboard order (a new rank group starts where `hasLeft` changes); `podiumSteps` keeps the top three rank groups among seated rows, labelled "1st"/"2nd"/"3rd", in display order second, first, third. Rows are `PodiumRow` (`playerId`, `name`, `score`, `rank`, `hasLeft`, `isMe`).

| Component | Props |
|---|---|
| `StatusPanel` | `title: string`, `detail?: string`, `tone: "wait" \| "done" \| "info"` |
| `Timer` | `seconds: number`, `total: number`, `announcement?: string` (polite live region text) |
| `PlayerSticker` | `name: string`, `playerId: string`, `size?: number` (default 44), `ghost?: boolean` |
| `Podium` | `steps: PodiumStep<TRow>[]` (from `podiumSteps`), `extra?: Snippet<[TRow]>` (rendered per occupant, e.g. a chip) |
| `QrCode` | `text: string` |
| `ActionBar` | `children: Snippet` |
| `NameInput` | `field: NameField`, `focus?: boolean` |
| `LobbySettings` | `vm: LobbySettingsViewModel<TState>` |
| `GameControls` | `vm: GameControlsViewModel<TState>` |

`LobbySettings` and `GameControls` render a viewmodel the game builds and passes in (`untrack(() => new GameControlsViewModel(manager, isGameOver))`).

```svelte
<script lang="ts">
  import { ActionBar, StatusPanel, Timer } from "@partygame/game-ui/components";
</script>

<Timer seconds={12} total={30} />
<StatusPanel title="Waiting for players" tone="wait" />
<ActionBar><button type="button" class="btn">Go</button></ActionBar>
```

Theming contract: the package ships no stylesheet. The game's CSS defines these, and the components read them.

- Custom properties: `--ink`, `--ink-soft`, `--white`, `--pink`, `--sun`, `--mint`, `--sky`, `--disabled`, `--tape-sky`, `--tape-mint` (`StatusPanel` sets `--tape` itself), `--fs-3`, `--fs-4`, `--fs-5`, `--font-display`, `--outline`, `--radius-card`, `--scrap-shadow`, `--scale` (optional multiplier, default 1), `--timer-size` (optional, default 96px).
- Global classes: `card`, `taped`, `sticker`, `hand` (`StatusPanel`); `sr-only` (`Timer`); `action-bar` (`ActionBar` renders it and styles nothing, so the game styles the bar, e.g. `.action-bar > .btn` and `main.tv .action-bar`).

## Bots

`@partygame/bots` plays any game. You write a `BotStrategy` (what a bot does in your phases); the package joins, names, paces,
de-duplicates, hosts and reports outcomes.

```ts
import { BotTable, DemoTable, joinBots, type BotKit, type BotStrategy } from "@partygame/bots";

const pressBot: BotStrategy<ButtonState> = {
  play: (turn) => {
    if (turn.state.phase === "Round") turn.once("press", () => turn.later("react", () => turn.act("PRESS")));
  },
};

export const buttonKit: BotKit<ButtonState> = { roomName: "button", stateClass: ButtonState, strategy: pressBot };
```

`play(turn)` runs on every state change; optional `host(turn)` runs first when the bot hosts (after the built-in `START_GAME`
once `canStart` holds and `host.expectedPlayers` seats are named). `turn` has:

| Member | What |
|---|---|
| `state`, `playerId`, `name` | the synced state and this bot |
| `once(key, run)` | runs `run` the first time `key` is seen in this phase |
| `later(speed, run)` | runs `run` after a `"think"`, `"react"` or `[min, max]` ms delay; cancelled on phase change or leave |
| `act(type, payload?, note?)` | sends an action; the result goes to `log` and `onOutcome` |
| `pick(items)` | a random item, `undefined` for an empty list |

Tables take the kit plus `endpoint`, `apiPort` and optional `bot` (`BotOptions`):

```ts
const bots = await joinBots({ ...buttonKit, endpoint, apiPort, code: "ABCD", count: 3 });

const table = new BotTable({ ...buttonKit, endpoint, apiPort });
const code = await table.open();                 // empty room, watched by the table
await table.seatBots({ count: 3 });              // once a human has joined and named themselves

const demo = new DemoTable({ ...buttonKit, endpoint, apiPort, bots: 3, isFinished: (s) => s.phase === "Done" });
await demo.open();                               // watch-only room (`seats`) with a host bot
await demo.seatBots();
await demo.finished();                           // rejects if the room closes
await demo.leave();
```

Overridable: `BotOptions` `thinkMs` (default `[2000, 6000]`), `reactMs` (`[500, 2500]`), `rng`, `schedule(run, ms) => cancel`,
`log`, `onOutcome`, `host.expectedPlayers`; `joinBots` `nameFor(n)` (default `Bot n`, taken names skipped), `playerIds`,
`timeoutMs` (`BotTable` and `DemoTable` also take `nameFor` and `timeoutMs`); `DemoTable` `hostName`, `roomOptions`, `isFinished`. Every failure leaves the seats it took.
Example: `games/wit-clash/bots/witClashBot.ts`.

A game declares its kit once as the `botKit` field of its declaration (`gamePackage.ts`) and never joins bots by hand:
the `bun run bots <CODE> [count]` entry is a stub calling `botsCli(gamePackage)` from `@partygame/game-kit`, which seats
the bots in a room made elsewhere (usage bounded by `meta.maxPlayers - 1`) and removes them on Ctrl+C.

## Terminal

`@partygame/terminal` lets a human play at a prompt. You write a `TerminalStrategy` (what to ask in each stage); the kit's `play`
entry drives it through a `TerminalPlayer` that keeps the lobby, the countdown, action replies and quitting, and a `PlaySession` that
finds or starts a server, creates or joins a room and seats bots. The samples here and in Launcher reuse `buttonKit`, `ButtonState` and `ButtonGame` from Bots and Minimal game.

```ts
import { type TerminalStrategy } from "@partygame/terminal";

const buttonTerminal = (): TerminalStrategy<ButtonState> => ({
  async play(turn) {
    if (turn.state.phase !== "Round") return;
    await turn.ask(`Press Enter to press!${turn.timeLeft()}`);
    await turn.send("PRESS", {}, "Pressed.");
    await turn.changed();
  },
  narrate: (state) => (state.phase === "Done" ? [`${state.winner} won`] : []),
});
```

Pass it as the declaration's `terminal` field and make the entry a stub:

```ts
// gamePackage.ts — the one declaration every entry stubs over
import { defineGamePackage } from "@partygame/game-kit";

export const buttonPackage = defineGamePackage({
  meta: { roomName: "button", minPlayers: 2, maxPlayers: 8 },
  definition: () => ButtonGame,
  stateClass: ButtonState,
  isFinished: (state) => state.phase === "Done",
  botKit: buttonKit,
  terminal: buttonTerminal,
});

// terminal/play.ts
import { play } from "@partygame/game-kit";
import { buttonPackage } from "../gamePackage.js";

await play(buttonPackage);   // bun run play [--bots=0..7] [--name=You] [--join=ABCD]
```

`play(turn)` runs once per stage, a stage being `stageOf(state)` (default: the phase). When the stage changes, the previous turn's
`signal` aborts and its pending `ask`/`changed` reject, so a strategy needs no cleanup. `turn` has:

| Field | What |
|---|---|
| `state`, `playerId`, `isHost` | the synced state, this player, whether they host |
| `signal` | aborts when the stage ends |
| `quitWord` | the word that leaves the game, lowercase |
| `ask(question)` | the trimmed answer; rejects when the stage ends |
| `print(line)` | prints a line |
| `send(type, payload, accepted)` | sends an action, prints `accepted` or the refusal; resolves true when accepted |
| `notify(type, payload)` | sends an action without waiting or printing |
| `changed()` | resolves on the next state change or when the stage ends |
| `timeLeft()` | `" 12s left"` from the server clock, `""` without a deadline |
| `quit()` | leaves the game; `run()` resolves |

Optional strategy members: `narrate(state)` returns lines to print on every state change, `lobby(turn)` replaces the built-in lobby
(host: Enter starts, `q` quits). The `play` entry parses `--bots`, `--name`, `--join`, `--endpoint` and `--api-port`, starts a server when the endpoint defaults are used and no room is joined, and exits 2 on bad arguments (as do `demo` and `bots`). `@partygame/terminal/testing` has test doubles. Example:
`games/wit-clash/terminal/witClashTerminal.ts`.

### All-bot demo run

The `demo` entry plays one game by itself on its own server (free ports): a host bot, N more bots and a narrating spectator, then prints
`PASS` or `FAIL`. It is the regression check for a game's bot strategy: the run fails when the game does not finish in the timeout
(default 180 s), when any bot action is refused, or when `problems(state)` reports something about the final state.

Declare what the demo needs on the declaration's `demo` field; `terminal/demo.ts` is a stub calling `demoCli(gamePackage)`:

```ts
// gamePackage.ts — the `demo` field of the declaration
demo: {
  bot: { thinkMs: [200, 900], reactMs: [100, 500] },   // pacing; kit, roomOptions and hostName also go here
  narrate: (state) => (state.phase === "Done" ? [`${state.winner} won`] : []),
  problems: (state) => (state.winner === "" ? ["nobody won"] : []),
},

// terminal/demo.ts
import { demoCli } from "@partygame/game-kit";
import { buttonPackage } from "../gamePackage.js";

await demoCli(buttonPackage);   // bun run demo [--bots=1..7]
```

`--bots=N` sets the bot count (default 3, bounded by `meta`; parsed by `parseDemoArgs`, so `--bots 4`, `--bots=` and unknown flags print the usage and exit 2). The field's extras are all optional: `kit` (a demo-specific kit),
`roomOptions`, `hostName`, `bot` (pacing and outcome logging), `narrate(state)`, `problems(state)` and `passMessage`. Under the hood
`demoCli` drives a `DemoRun` from `@partygame/terminal`. Example: `games/wit-clash/gamePackage.ts` (the Narrator narrates and checks).

## Launcher

`@partygame/launcher` starts a game's server, the code API and the client (Vite or the built `dist/`) and optionally seats a bot table
or opens a demo room. A game does not call it directly: the declaration carries what the launcher needs, and `launch.ts` is a stub:

```ts
import { fileURLToPath } from "node:url";
import { launch } from "@partygame/game-kit";
import { buttonPackage } from "./gamePackage.js";

await launch(buttonPackage, { gameDir: fileURLToPath(new URL(".", import.meta.url)) });
```

`launch` builds the config from the declaration (`buildLaunchConfig`) and runs it with `runLauncher`: `name` is `displayName` (or
`meta.roomName`), `bots` is the declaration's `botKit` capped at `maxPlayers - 1`, and the demo tables run `minPlayers - 1` to
`maxPlayers - 1` bots plus a host bot, finished by `isFinished`, with the declaration's `demo` extras (kit, room options, host name,
bot pacing) merged in.

`gameDir` holds `server.ts` (run with env `PORT` and `API_PORT`), a `package.json` with `dev` and `build` scripts, and the built `dist/`.

| Argument | What |
|---|---|
| `dev` (default) / `host` / `prod` | Vite with hot reload on 5173 / the same plus the LAN addresses guests join on / build, then serve `dist/` on 3000 |
| `--no-browser` | do not open a browser tab |
| `--bots[=N]` | open a room for you and seat N bots (1 to `bots.max`, default `bots.default` or 3) once you have entered your name |
| `--demo[=N]` | a watch-only room that N bots plus a host bot play alone; the browser opens its TV view (`demo.min` to `demo.max`). Excludes `--bots` |

The launcher refuses to start when a port is taken, stops everything on Ctrl+C and exits 1 if a service dies. Its full config
(`ports`, `commands`, `readyTimeoutMs`, `openBrowser`, `log`) and pieces (`Launcher`, `parseLaunchArgs`, `ProcessGroup`, `StaticSite`,
`lanUrls`, `openBrowser`) are documented in `packages/launcher/README.md` for tests and custom launchers.

The repo root has no game code. `scripts/game.ts <command> [game] [...args]` runs `games/<game>/<entry>.ts` by convention:
`launch` runs `launch.ts`, `play` runs `terminal/play.ts`, `bots` runs `bots/cli.ts`. A game is a folder under `games/` with a
`package.json`. It is picked by the first argument when that names a game folder; otherwise the only game is used; with several games
and a terminal it asks (`Pick a game [1-N]:`; empty input or end of input exits 2), and without a terminal it prints the list and exits 2.
`bun run games` lists every game and the commands it has an entry for.
`bun run launch`, `launch:dev`, `launch:host`, `launch:prod`, `launch:bots`, `launch:demo`, `play` and `bots` all go through it:
`bun run launch my-game --demo`, or `bun run scripts/game.ts launch my-game dev --demo`. A missing entry prints
`<game> has no <command> entry (<path>)` and exits 2.

## Config presets

`@partygame/config` (add it as a devDependency) holds the build and test config so a game's config files are one-liners. It is built to `dist/`; `vite`, `vitest`, `svelte` and `@sveltejs/vite-plugin-svelte` are peer dependencies.

| Subpath | Gives |
|---|---|
| `/vite` | `defineGameViteConfig({ port?, overrides? })`: Svelte plugin, LAN-reachable dev server (default port 5173), the `development` resolve condition only for `vite serve`; `overrides` is merged last |
| `/vitest` | `uiTestConfig(options)` (jsdom + Svelte, default `setupFiles` jest-dom and `@partygame/game-client/test-setup`) and `nodeTestConfig(options)`; options are `{ name, coverage, include?, exclude?, setupFiles?, overrides? }` |
| `/svelte` | `svelteConfig`: `vitePreprocess()` and runes mode |
| `/tsconfig.base.json`, `/tsconfig.game.json` | the shared compiler options, and the game's (bundler resolution, `isolatedModules`, `verbatimModuleSyntax`, test types) |

```ts
// vite.config.ts
import { defineGameViteConfig } from "@partygame/config/vite";
export default defineGameViteConfig();

// vitest.config.ts (UI tests); nodeTestConfig for rules, bots and terminal tests
import { uiTestConfig } from "@partygame/config/vitest";
export default uiTestConfig({ name: "my-game", coverage: ["src/**/*.ts", "ui/**/*.ts"] });

// svelte.config.js
export { svelteConfig as default } from "@partygame/config/svelte";
```

```json
{ "extends": "@partygame/config/tsconfig.game.json", "include": ["src/**/*.ts", "ui/**/*.ts", "ui/**/*.svelte", "tests/**/*.ts"] }
```

`include` defaults to `tests/**/*.test.ts`; `exclude` always adds `dist/**`, `node_modules/**` and `coverage/**`; a given `setupFiles` replaces the UI default. The root `vitest.config.mts` finds `games/*/vitest*.config.ts` by glob, so a new game needs no root edit.

## Helpers

| Import | What |
|---|---|
| `@partygame/shared` | `NAME_MAX_LENGTH`: the cap `SET_NAME` enforces on player names; `MAX_SEATS`: the most playerIds a room's `seats` option may list; `MAX_OPTIONS_JSON_LENGTH`: the cap on serialized options at room creation and in `SET_OPTIONS`; `ROOM_CODE_LENGTH` and `ROOM_CODE_ALPHABET`: the shape of a room code; `sanitizeRoomCode(raw)`: uppercases, drops other characters and cuts to the code length (for a code input) |
| `@partygame/client-utils` | `Parsed<T>` (`{ ok: true, value } \| { ok: false, error }`) and `between(value, min, max)` for argument parsing; `waitFor(predicate, what, timeoutMs)` poll loop; `resolveRoomCode(apiBase, code)` (rejects with `RoomCodeError`, `reason` `"not-found"` or `"bad-reply"`); `joinUrl(base, code)` / `tvUrl(base, code)` share links; `claimName(room, playerId, name, timeoutMs?)` (type `SeatRoom`), `apiBaseOf(endpoint, apiPort)` |
| `@partygame/core` | `shuffle(items, rng)`, `required(value, what)` |
| `@partygame/server/node` | `startNodeServer({ games, port?, apiPort? })` (a game server and its API in this process; `.stop()`), `serveApi(codes, { port, host? })`: the code API on Node's `http` (the Bun entry serves its own) |
| `@partygame/server/probe` | `ServerProbe` (`isGameServer(port, apiPort)`, `canConnect(port)`, `answers(url)`), `freePort()`, `closeHttpServer(server)` (resolves when the server already stopped): port probing without Colyseus |
| `@partygame/content` | `loadJsoncDir(dir, schema, { idOf, label, onInvalid?, maxFiles?, maxFileBytes? })`: a folder of commented JSON files (symlinks ignored), validated; bad files throw by default (`onInvalid: "skip"` warns and skips), caps at 256 files / 1 MiB per file; `stripJsonComments` |
| `@partygame/content/filter` | `createTextFilter()`: a `TextFilter` over the English obscenity dataset — `check(text, "off" \| "moderate" \| "strict")` returns `{ ok: true }` or `{ ok: false, reason }`; moderate blocks slurs and profanity, strict adds mild terms; the reason is a fixed per-level string that never names the matched word |
| `@partygame/game-client` | `resolveEndpoints(overrides, pageHost)`, `readCodeParam(search, "code" \| "tv")` |
| `@partygame/game-client/test-setup` | vitest `setupFiles` entry for jsdom: storage shims, SDK on `ws` (repo-internal, raw `.ts`) |
| `@partygame/game-kit` | types: `GameMeta` (`roomName`, `minPlayers`, `maxPlayers`), `ServeOptions` (`games`, `port?`, `apiPort?`), `GameDemoOptions` (the declaration's `demo` field, see All-bot demo run) |
