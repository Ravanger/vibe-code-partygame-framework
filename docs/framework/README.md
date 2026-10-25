# Party Game Framework: game author guide

You describe a game as data: phases, the actions players may send in each phase, and optional timers.
The framework supplies the lobby, room, roster, reconnection, timers and wire protocol.

Dependency direction: `games/* -> @partygame/server -> @partygame/core -> @partygame/shared`.

Known traps (build, coverage, reconnects, Schema 5): [troubleshooting.md](troubleshooting.md).

**Security:** What the framework protects and what it does not: [threat model](security/threat-model.md).

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
Each phase may declare `onEnter`, `duration` + `onTimeout`, `onTick`, `onRosterChange` and `actions`.
Move between phases only with `ctx.transition("Name")`; it is queued and applied after the current hook returns.
Transitioning to the current phase re-enters it and restarts its timer.
`ctx.returnToLobby()` calls `onReturnToLobby` and enters `Lobby`.

### Actions
An action is a client message `{ type: "SCREAMING_SNAKE_CASE", ...fields }`.
Declare it in the phase that accepts it: `from` (`"host"` or `"player"`, where `"player"` means any active player including the host),
a zod `payload` schema that validates the whole action object, and a `handler`.
The envelope is flat and capped at 32 top-level keys (more is `INVALID_ACTION`). `type` is reserved for the
action name: do not declare it in a payload schema, and `sendAction` refuses to send a payload that carries a
`type` field. Write payload schemas that keep unknown keys out of your handler: plain `z.object` strips them
(the default — dispatch parses the whole envelope, so a strict schema would also reject the reserved `type`),
while `z.looseObject` passes them through and should be avoided.
Every rejection is sent only to the sender as `ERROR { code, message, action }`:

| Code | Cause |
|---|---|
| `INVALID_ACTION` | malformed envelope (including more than 32 keys), or payload failed its zod schema |
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

### Audience
An action can be declared `from: "audience"` instead of a role: it is sent by a seatless sender identified by an opaque
`audienceKey` string and dispatched through `runtime.dispatchAudience(audienceKey, raw)` rather than `dispatch`. The key only
identifies the sender — to middleware, rejections and the action log (`senderId`) — and is never persisted; audience identity
lives in memory for the room's lifetime.

The handler receives an `AudienceActionContext`: like `ActionContext` without `playerId`, plus `audience: AudienceScope` with a
single method, `once(scope)`. It returns `true` the first time that key uses that scope and `false` afterwards — count one vote per
audience member per option without any per-member state (write the counts into synced state as plain counters). The host clears
every scope when the phase changes (`RuntimeHost.audienceOnce`, cleared in `notifyTransition`), so a new round accepts fresh votes.

Refusals mirror the player path: a seated player who sends an audience action gets `NOT_ALLOWED`; an audience key that sends
anything but an audience action gets `UNAUTHORIZED`. Payload validation, middleware and the failure policy are identical to
`dispatch`. In replay, an entry whose sender is not in the recorded roster is re-dispatched through `dispatchAudience` (legacy
logs without a roster keep player dispatch).

On the server, spectators are the audience. A seatless connection may send `ACTION` only for an action declared
`from: "audience"` in the current phase; anything else (a player action, a built-in, an action of another phase) gets the
same `UNAUTHORIZED` spectator refusal as before audience actions existed. The audience key is the spectator's join
`playerId`: once-scopes survive that connection dropping and reconnecting within the phase, and are cleared on a phase
change, not on disconnect. Spectator actions draw from the same ACTION rate-limit bucket, keyed per connection and freed
when the spectator leaves. Audience identity is in-memory and unauthenticated — a client that rotates its join `playerId`
gets fresh scopes — so audience votes count participation, not commitments.

### Host controls
The runtime handles these host-only actions for you; do not declare them (`defineGame` rejects the names):

- `START_GAME` (Lobby), see Lobby below.
- `KICK_PLAYER { playerId }`: any phase, not yourself. The host implementation removes the seat, then `onRosterChange` runs. The ban is per `playerId` and per the kicked seat's secret hash: a kicked client that rejoins with a fresh id but its stored secret is refused with `KICKED_REJOIN` too (IPs are not used — they are shared on a LAN). A player who leaves normally can rejoin.
- `SET_OPTIONS { ...partial }`: Lobby only. If the game declares no `definition.options` schema, it rejects any key but `type` (`INVALID_ACTION`); a room for such a game also refuses create options. Otherwise the partial is merged into the current options and validated, then published; a failed parse or a result whose JSON is longer than `MAX_OPTIONS_JSON_LENGTH` is `INVALID_ACTION` and keeps the previous options. `ctx.options` reflects the new value.
- `END_GAME`: any phase but the Lobby (`WRONG_PHASE` there). It runs `onEndGame(ctx)`, where a game can set a notice for the players, and then returns everyone to the Lobby as `ctx.returnToLobby()` does (`onReturnToLobby` runs, waiting joiners are let in). The hook cannot veto it.

### Roster changes and mid-game joiners
Joins, leaves, disconnects, reconnects and ready changes call the current phase's `onRosterChange(ctx)`.
Use it to re-check completion ("everyone has answered") so a leaver cannot stall the game.
For minimum-player guards use `seatedCount(ctx)` / `isBelowMinimum(ctx, min)` — they count active and ready seats including briefly disconnected ones, so a dropped connection does not end the game — and `departedIds(ids, ctx)` for the ids that lost their seat; all three only report, so you write the notice and decide to end.
Someone who joins mid-game is seated but not active, so they spectate and their actions get `NOT_ACTIVE`.
Call `ctx.activateWaitingPlayers()` at a natural break in your game to let them in. It activates only ready seats (seats that have set a name);
an unnamed seat stays waiting, and in the Lobby a seat that sets its name is activated at once.
A seat that joined the Lobby is active, but when the game leaves the Lobby (`START_GAME` or auto-start) every seat that is still unnamed is benched (`RuntimeHost.benchUnreadyPlayers`) and waits for the next activation.
After a player reconnects, `onPlayerSync(ctx, playerId)` runs so you can resend their private messages.

### Timers
`duration` is milliseconds, or a function of the context. The timer restarts on every entry (including re-entry).
`onTimeout` is required whenever `duration` is set, fires once, and never fires after the phase was left.
The server owns the clock: clients render a countdown from `phaseEndsAt`.

A real-time phase declares `onTick(ctx, dtMs)`, called every `tickMs` while the phase is active — default 100 ms (10 Hz); it must be an integer >= 1 and is rejected at definition time without `onTick`.
`dtMs` is that nominal interval, not wall-clock elapsed time, so integrating state by it (`pos += speed * dtMs / 1000`) is deterministic: tick k fires at enter + k·tickMs, and `replayLog` reproduces exactly those ticks because the replay clock advances fire precisely the ones due between logged entries.
Ticks stop as soon as the phase is left — including a transition queued from within `onTick` — and on shutdown; leaving and re-entering restarts the cadence.
Like `onPlayerSync`, ticks are not wrapped by phase middleware.
On a live room the Colyseus clock quantizes delivery to its ~16 ms grid, so a tick can land up to one grid step late relative to enter + k·tickMs: an action in that window sees one fewer tick than a replay would. Timeouts have the same skew and the log corrects them; ticks are too chatty to log; closing the gap is tracked in #246.

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
5. Rejecting: middleware gets `ctx.reject(code, message, options?)` for `action` events (it throws for any other event kind) — the sender gets the `ERROR` with that code and message, and the rejection counts in `rejectionCount`. Pass `{ redactPayload: true }` to also count it in `redactedRejectionCount`: an action log then records the entry with `rejected: true`, `redacted: true` and no `payload`, so rejected text (like a filter hit) never lands in the log or a replay bundle. It does not stop the chain by itself: omit `next()` to keep the handler from running. Middleware still cannot cancel a queued transition.
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
- `textFilterMiddleware(filter)` — rejects an action whose declared text fields fail the room's filter level. Declare which payload fields are free text per action (`textFields: ["..."]` on the action definition; the framework never guesses) and how strict this room is via `filterLevel?: (options) => "off" | "moderate" | "strict"` on the game definition (default `"off"`). For each declared string field it runs `filter.check(value, level)` in declaration order and, on the first failure, rejects with `CONTENT_REJECTED` and the filter's reason — always with `redactPayload`, so an action log records the rejection without the offending text — without running the handler. Pass `{ onRejected?(ctx, reason) }` as the second argument to be told about each refusal (after the rejection is recorded); the game can react (e.g. count rejections) but cannot change the outcome. A `TextFilter` comes from `@partygame/content` (`createTextFilter()` is the default English one); at `"off"` the filter is never called, and actions without `textFields` pass untouched.

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
| `protocolVersion` | The framework's `PROTOCOL_VERSION` at record time; `replayLog` refuses a log recorded under another one, or one without it (recorded before protocol versioning) |
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
| `redacted` | `kind === "action"` only; `true` when the rejection asked for payload redaction (`ctx.reject` with `redactPayload: true`) — the entry then carries no `payload`. The action was refused before the handler ran, so it changed no state and `replayLog` skips re-dispatching it. Implies `rejected: true` |
| `from`, `to` | `kind === "transition"` only |

Actions rejected **before the handler chain** — malformed envelope, unknown action, unauthorized sender,
inactive player, invalid payload — are **not** logged: they never reach the middleware and change no state.
An action whose *handler* calls `ctx.reject()` or throws a `FrameworkError` (as the built-in `START_GAME` does with too few players) has reached the chain and **is** logged, marked
`rejected: true`; it changes no state either, and such logs replay — the re-dispatch re-runs the handler
(RNG draws included) and must reject again (a mismatch in either direction throws). A rejection recorded with
`redactPayload: true` — a middleware that refused the action before the handler ran (the text filter does this) — is logged with `rejected: true`,
`redacted: true` and no `payload`; because it changed no state and drew no RNG, `replayLog` skips re-dispatching it
(the clock still advances to its `t`). For such refusals to be logged at all, register the logger outside the
refusing middleware (`middleware: [actionLogMiddleware(), textFilterMiddleware(filter)]`) — a layer that omits
`next()` never runs what is inside. Roster changes are recorded for observability (see the replay limitation below).

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
  so published ids do not reveal the stream. `ReplayHost`, `FakeHost`/`TestTable` accept a `Seed` or a
  number (expanded by `seedFromNumber`); an unseeded host is `seedFromNumber(0)`, so even unseeded test
  rooms are replayable by seed (and their ids from `ctx.newId()` stay unique).
- **Clock.** Replay scripts the fake clock: it advances to each entry's `t` before applying the entry, and
  logged timeouts are authoritative — when replay enters a timed phase, its timer is made to expire at the
  time recorded in the log. A live room's phase timers run on Colyseus's tick-quantized clock (a ~17 ms
  grid), so a timeout can fire a few ms early or late relative to enter + duration; `phaseEndsAt` in
  replayed snapshots is the logged timeout time, not enter + duration.
- **IDs.** Identifiers that land in synced state or an action payload must come from `ctx.newId()` (drawn
  from the room RNG). `crypto.randomUUID()` breaks replay: re-dispatched payloads reference ids the fresh
  runtime never generated.

**Replay.** `replayLog(definition, log, init)` (from `@partygame/core/replay`; `@partygame/core/testing`
re-exports it for existing test suites) re-drives a fresh runtime on a `ReplayHost` — same definition, RNG
seeded from the header, clock starting at `header.startedAt`, the recorded roster pre-seated with its flags
restored (`p1..pN` mapped positionally; a log without a roster — a lobby-only session — needs `init.players`
instead, which pre-seats that many seats) — dispatching every logged action in order:

```ts
import { replayLog } from "@partygame/core/replay";

const { states } = replayLog(ButtonGame, log, {
  state: new State(), // same shape as passed to TestTable
  options: {},
  // players is only needed for logs without a recorded roster (lobby-only sessions)
  // seed defaults to log.header.seed
});
```

`states[0]` is the fresh construction at `header.startedAt`, before any entry; each following element is
one deep-cloned snapshot per step — every logged `action`, `timeout` or lobby `roster-change` starts a step
(the roster change re-runs the lobby hook only when it auto-started the session, so the replay performs the
same start at the same time; any other one advances the clock and nothing else), and the transitions and
enters that follow from it belong to the same step. It throws when
the log's shape is malformed — validated up front against `ActionLogSchema` with named errors: `entries`
not an array, an entry that is not an object or lacks a known `kind`, numeric `t` and `seq` and a string
`phase`, `header` missing or lacking a string `game`, a four-number `seed` and number `startedAt`, a roster
entry missing its `id`/flags, or any unknown field anywhere in the log (the schema is strict) — when the
first entry is not the construction-time Lobby enter (every recorded session starts with it), when the log's `game` does not match the definition, when its `version` differs from the
definition's or is absent (a log predating versioning), on a mid-game roster change, on out-of-order
entry times,
when a re-dispatch rejects an action the log records as accepted or accepts one recorded with
`rejected: true` (a mismatch in either direction means the log is not what this definition produces), or
when a logged transition or enter contradicts what the replayed runtime actually did — each step asserts
its own consequence run, so a tampered log throws naming the mismatch.

`ActionLogSchema` (from `@partygame/core`) is the zod schema behind that validation: strict objects over
the exact log shape. It is also the gate for untrusted logs — replay bundles and spectators (#19) parse
with it before anything else runs. `ReplayHost` (from `@partygame/core/replay`) is the host `replayLog`
drives: a minimal `RuntimeHost` with a manual clock (`advance(ms)`), seats and the given seed, and no
recording or assertion helpers — client traffic is dropped. Build one directly to drive a `GameRuntime`
over a log yourself.

**Bundles.** A `ReplayBundle` (from `@partygame/core/replay`) is what a finished session is shared as: the
action log plus `name`, `frameworkVersion`, `gameVersion` and a game-supplied `contentHash`, and
`snapshots` — one synced-state snapshot per phase transition, for viewing without re-running the runtime.
The room records each snapshot as it transitions: the runtime calls `RuntimeHost.notifyTransition(from, to)`
after the transition's middleware event, and the server serializes the state with `syncedJsonOf` (from
`@partygame/shared/schema`) — plain JSON of the synced state with `.view()` fields dropped at every level, so
a snapshot never carries `ctx.priv` or per-client data. Each snapshot names the `seq` of the log's
`transition` entry it belongs to and shows that transition's `from` phase — the final state of the phase
being left.

The host exports with `room.request(ClientMessage.EXPORT_REPLAY)`; the answer is an `ExportReplayResponse`
(from `@partygame/shared`) — the bundle, or a refusal shaped like a rejected `ActionResult`: `UNAUTHORIZED`
for a non-host (including spectators), `NOT_ALLOWED` when the game records no action log or its logged
transitions do not match the recorded snapshots (a middleware that drops transition events makes export
impossible), and `INTERNAL` if building the bundle throws. The bundle's `frameworkVersion` is
`FRAMEWORK_VERSION` from `@partygame/shared`; `contentHash` comes from an optional
`definition.contentHash()` — a synchronous hash of what the game plays from (WitClash hashes its category
files), defaulting to `""`.

`createBundle(parts)` stamps the current format version. `parseBundle(json)` validates untrusted bundle
JSON against `ReplayBundleSchema` (strict objects, snapshot state as JSON) and throws a named error on an
unknown `bundleVersion` — the common "written by a newer framework" case. `hashBundle(bundle)` is the
sha-256 hex digest of the bundle's canonical JSON (object keys sorted; arrays keep their order), computed
with Web Crypto so it runs in browsers, and stable across key order. `verifyBundle(bundle)` checks
consistency without a runtime — the log header must match the bundle's `name`/`gameVersion`, and snapshot
`seq`s must be strictly increasing with each naming a `transition`/`enter` entry in the log — returning
`{ ok: true }` or `{ ok: false, seq, phase, reason }` for the first failure (non-snapshot failures report
`seq: 0`).

**Viewing.** A bundle is meant to be watched without re-running the runtime: `ReplayViewModel` (from
`@partygame/game-ui`) takes the bundle file's text, validates it structurally (a wrong `bundleVersion`,
missing or malformed snapshots set its `error` and leave no snapshots) and steps through the `snapshots` —
`index`, `current` (the snapshot's synced state as plain JSON) and `phase` are reactive, `next()`/
`previous()`/`goTo(i)` clamp at the ends, and `play()` auto-advances on an injectable timer.
`snapshotManager(viewModel, stateClass)` adapts it to the shape screens read from a `GameConnectionManager`:
`state` is a fresh `stateClass` instance filled from the current snapshot (via `syncedStateFromJson`, the
inverse of `syncedJsonOf`, from `@partygame/shared/schema`), and `isSpectator` is always true — so a game's
existing screens render a replay read-only. Snapshots hold synced state only: no private or per-client data,
and player ids are the live ones (no `p1..pN` remapping).

**Limitations in v1.** Mid-game roster changes are not replayed: `replayLog` throws naming the first such
entry. Lobby-phase roster changes are skipped — the table is already seated — except the one that
auto-started the session, which re-runs so the replay performs the same start at the same time; a game whose
`Lobby.onRosterChange` writes synced state may diverge in intermediate states for sessions with other lobby
joins/leaves (final states still match). A sender that is not in the recorded roster (for example a joiner of
a second session after `returnToLobby`) makes the re-dispatch throw. Synced state that stores seat ids (for
example a winner) holds the replay seats' `p1..pN` ids, not the live ones — the same seats positionally. A log that contains a failed run
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
string the game author bumps; compared by exact equality). `header.protocolVersion` (the framework's
`PROTOCOL_VERSION`, bumped with breaking wire or log-format changes — see Protocol versioning) is compared
by exact equality too: a log recorded under another protocol, or without one, is refused outright. The
header seed is recorded as well, but to reseed the runtime, not to compare.

**Old logs.** A mismatch surfaces as a named `replayLog:` error — or, for changes that only alter state
values, as a replay that completes with different states. No migration exists: a log without
`header.version` (recorded before versioning) or `header.protocolVersion` (recorded before protocol
versioning) is refused outright. The recommended practice is to keep the
game at the recorded name and version to replay its log — bump `version` whenever you change anything the
table above marks "yes".

**Runtime additions.** Action middleware events now carry the zod-parsed `payload`; every context exposes
`ctx.gameName` (definition name), `ctx.gameVersion` (definition version, recorded in the log header),
`ctx.seed` (room RNG seed, recorded in the log header) and `ctx.newId()` (deterministic ids — see the
Determinism contract above). Middleware contexts additionally expose `ctx.rejectionCount` — the live count
of rejections (`ctx.reject()` calls and a handler-thrown `FrameworkError`) for the current dispatch, so a middleware can tell after `next()` whether an action's
handler rejected.

### Awards
`@partygame/core/awards` lets a game declare awards as data — pure reducers over the session's action log —
and compute them when the session ends:

```ts
import { getActionLog } from "@partygame/core";
import { computeAwards, type AwardDefinition } from "@partygame/core/awards";

const fastestAnswer: AwardDefinition = {
  id: "fastest-answer",
  title: "Fastest answer",
  higherIsBetter: false, // the smallest delta wins
  reduce(entries) {
    const scores = new Map<string, number>();
    let windowStart: number | undefined;
    let answered = new Set<string>();
    for (const entry of entries) {
      if (entry.kind === "enter") {
        windowStart = entry.t; // a new phase opens a new answer window
        answered = new Set();
        continue;
      }
      if (entry.kind !== "action" || entry.actionType !== "SUBMIT" || entry.senderId === undefined) continue;
      if (windowStart !== undefined && !answered.has(entry.senderId)) {
        scores.set(entry.senderId, entry.t - windowStart); // first answer in the window only
        answered.add(entry.senderId);
      }
    }
    return scores;
  },
};

// Wherever the session ends (e.g. the Results phase):
const log = getActionLog(ctx.priv);
if (log) for (const award of computeAwards(log, [fastestAnswer])) { /* award.winners, award.scores */ }
```

- `AwardDefinition` is `{ id, title, reduce(entries, roster), higherIsBetter? }` (default `true`). `reduce`
  receives the log's entries — rejected ones (`rejected: true`) are filtered out before any reducer runs,
  because they changed nothing and score nothing — plus the recorded roster (an empty array when the session
  never started), and returns a `Map<playerId, number>`. Entries and their payloads are read-only.
- `computeAwards(log, defs)` returns one `AwardResult` per declaration, in order: `{ id, title, scores,
  winners }`. `winners` carries the best score(s) — ties share, in the score map's iteration order — and is
  empty when the reducer returned no data.
- An award that needs game state at each step (anything not a fact about the log) uses the escape hatch: the
  game feeds accumulators into its private state as play progresses, then declares the award with a reducer
  that ignores the log — a closure over the final private data, e.g. `reduce: () => new Map(
  Object.entries(ctx.priv.fastestTimes))`. There is no framework code for this; it is the game's own
  bookkeeping.

### Protocol versioning
`PROTOCOL_VERSION` (from `@partygame/shared`) is an integer identifying the wire and action-log protocol.
Every first-party client — the browser SDK (`GameConnectionManager`), bots (`joinBots`, `BotTable`,
`DemoTable`), the terminal client (`GameClient`) and the test helpers (`TestServer.createRoom`/`join`/`joinAs`)
— sends it as `protocolVersion` in its create/join options. Both option schemas accept an optional integer
`protocolVersion`. The server enforces it on every create and join, before any seating work: a missing or
different version is refused with close code 4426 (`CLOSE_CODES.VERSION_MISMATCH`) and the message
`Protocol version mismatch: client {client}, server {server}` filled from numbers only — a missing client
version renders as `unknown`. The browser SDK shows that filled text in `lastServerError`; token reconnects
are not re-checked, since they carry no options. Bump the constant whenever you change anything breaking on
the wire or in the log format: every first-party client then sends the new number from one place, and a
mismatch is a close, not a negotiation.

### Errors at definition time
`defineGame` throws `GameDefinitionError` listing every problem: empty `name` or `version`, reserved or unknown
phase names, missing `startPhase`, `duration` without `onTimeout`, `tickMs` without `onTick` or a non-integer `tickMs` below 1, bad player limits, bad action names.
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
  | 4406 | `SEAT_TAKEN` | `UNAUTHORIZED` | Seat is taken |
  | 4409 | `SEAT_TAKEN_OVER` | `KICKED` | Your seat was opened on another device |
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
`activateWaitingPlayers`, and `setTimeout`/`clearTimeout`, which pass a branded `TimerHandle` (a number) between them (the runtime's XState actor uses these as its clock).
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

Elsewhere: `createGameServer({ games, roomCodeService?, transport?, maxPayloadBytes?, maxRooms?, reconnectMs?, emptyRoomGraceMs?, audienceSlots?, textFilter? })` returns the Colyseus `Server`,
and `createApiHandler(roomCodeService, { allowedOrigins? })` is the pure `(request, info?) => Response` behind `/api/resolve-code`: it answers with CORS headers only for origins in `allowedOrigins` (exact origins or `scheme://host:*` patterns; `"*"` for all) — by default loopback on any port, the dev client — echoing the origin with `Vary: Origin`; a disallowed origin gets no CORS headers, so the browser blocks it while non-browser callers still get the answer. The HTTP entries (`serveApi`, the Bun `startServer`) forward the request's method and headers and pass `{ remoteAddress }` as the second argument, and they bind the code API to loopback by default: `host` (or env `HOST`) picks another interface, and `allowedOrigins` (or env `ALLOWED_ORIGINS`, comma-separated, `*` for all) widens who may read it.
The largest accepted WebSocket frame is `maxPayloadBytes` (default `DEFAULT_MAX_PAYLOAD_BYTES`, 4096), enforced on both transports; a bigger frame closes only that connection (code 1009) and leaves the room and its other players untouched.
The number of concurrent rooms across all games is capped by `maxRooms` (default `DEFAULT_MAX_ROOMS`, 100; `Infinity` removes the cap): a create beyond the cap is refused with close code 4429 (`SERVER_FULL`, "Server is full") and existing rooms keep working; a slot frees again when one of the rooms is disposed.
Rate limits are configured with `rateLimits`: actions per player (default 10/s, burst 20), `SET_NAME` per player (default 2/s, burst 2) and `/api/resolve-code` per remote address (default 1/s, burst 10), plus `mode: "observe" | "enforce"` (default `"enforce"`). Actions and `SET_NAME` are enforced in every room through one shared limiter: buckets are keyed by room, player and message type, so a reconnect cannot reset them, and they are freed when a seat leaves or the room is disposed. An over-limit message is refused with `RATE_LIMITED` — pushed as `ERROR` and returned in the `ActionResult` of a request — without touching other players; the refusal happens before the runtime, so it is not logged and replay is unaffected. The code API enforces its bucket in the HTTP entries: an exhausted address gets 429 with `Retry-After` (seconds until the next token) and the CORS headers of its origin, and callers whose remote address is unknown share one bucket instead of getting unlimited access. In observe mode an over-limit message or request is logged through `console.warn` instead of being refused.

Clients join with `{ playerId, name?, seatSecret? }` (`spectator: true` for a TV display: no seat, counted in `spectatorCount`; spectators need no secret).
Create a watch-only room with the framework option `seats: string[]` (the playerIds allowed to take a seat): any other non-spectator join is refused with `4404 "This room is watch-only"`, spectators still join. It is not a game option and is not published in `state.options`.
`SET_NAME` readies a seat (a name another seat has is refused with `NAME_TAKEN`; a join-time `name` that is taken is ignored and the seat joins unnamed). With a `textFilter` on `createGameServer`, names are also checked against it at the level of the game's `filterLevel` over the room's current options (default `"off"`): a join with a filtered name is refused with close code 4405 (`CONTENT_REJECTED`) and a `SET_NAME` with one is refused with `CONTENT_REJECTED` and the filter's reason, keeping the old name; a level raised mid-lobby applies to the next `SET_NAME`, not to names already set. A room is kept alive only by connected seats: once the last one is gone for `emptyRoomGraceMs`, the room is disposed and any spectators are disconnected. `ACTION` carries your actions (`room.send` or `room.request`, see Actions). `EXPORT_REPLAY` (host only, via `room.request`) answers with the room's replay bundle — see Bundles below; a non-host gets an `UNAUTHORIZED` refusal. A dropped connection holds the seat for `reconnectMs`: a token reconnect, or a new session presenting the same `playerId` and that seat's `seatSecret`, resumes it.
Every non-spectator join must present a `seatSecret`: the server stores its sha256 per seat (never in synced state) and refuses a missing or wrong one with `4406 "Seat is taken"` — including the first join of a new player, so there is no migration for secretless clients.
A matching secret takes the seat over even while the old owner is still connected: the new session binds to it and the old one is closed with `4409 "Your seat was opened on another device"`.
A mid-game joiner is seated inactive.
When the host leaves or drops, the role moves to a connected seat that is active and ready, else one that is ready, else any connected seat.
Spectators get no reconnection window; they simply rejoin.
A room admits at most `maxPlayers + audienceSlots` connections in total (default 32 audience slots, `DEFAULT_AUDIENCE_SLOTS`; set `audienceSlots` on `createGameServer`). Once the total is reached Colyseus locks the room's listing and further joins are refused at matchmaking time: the client gets a matchmake error (`"room … is locked"`, code 522), not a join close code.

### Private state with StateView
Tag a synced field `.view()`, put per-player entries in it, and reveal each with `ctx.showTo(playerId, entry)`;
`ctx.hideFrom` revokes. The room remembers what each player may see and re-applies it on every reconnect, so nothing is resent.
Call `hideFrom` before you delete an entry, or the room will try to re-add it on reconnect.

The boundary is enforced mechanically at startup: `createGameServer` checks every hosted state class and fails loudly —
naming the class and every offending field — if a field is neither tagged `.view()` nor listed in the game's
`publicFields` (fields of `BaseGameState` are always allowed; nested schema classes inherit their holding field's
visibility). Declare the list on `HostedGame.publicFields`, or on the game-kit declaration's `publicFields`, which is
handed to the server. A state class with no own fields beyond `BaseGameState` needs no list.

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
Every join sends a seat secret: `t.seatSecretFor(playerId)` returns the stable per-player-id value, so a test reconnect presents the same one.
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
| seat secret | sent on every `join`: two UUIDs joined, generated once per session and kept in `localStorage` under `${storagePrefix}.seatSecret`. Cleared with the rest of the session when leaving, so a re-join gets a fresh one |
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
`state.ts` so the browser bundle never reaches `@colyseus/core`. `@colyseus/schema` is allowed in `shared/schema` and in a game's `state.ts`; `@colyseus/core` only in `server`. Also there: `syncedJsonOf(state)` — plain JSON of a synced schema state with `.view()` fields dropped at every level (arrays and maps serialized item by item); the server uses it for replay snapshots.

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

`LobbySettingsViewModel` takes the same options schema you pass to `defineGame`, optional `defaults` shown until the server publishes valid options, and optional `labels`. Every bounded numeric option (`.min()` and `.max()`) appears in the form with no UI work; a string-enum option (`z.enum([...])`) appears as a row of choice buttons, one per value, also with no UI work; a field is labelled from its camelCase key ("Turn seconds") unless `labels` overrides it:

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

## Bundle size

Each game builds its own client with `vite build`; there is no multi-game bundle. The reference game `wit-clash` is measured on every CI run: `bun run check:bundle` rebuilds it and fails when the gzip total of `dist/**/*.{js,css}` exceeds the budget in `scripts/bundle-budget.json`. The budget is the measured gzip total rounded up to the next 1 kB (1024 B), plus 10% — currently **130,905 → 131,072 → 144,180 bytes**. When a change legitimately grows the bundle, update `scripts/bundle-budget.json` and the numbers below in the same PR.

Measured with `bun run --cwd games/wit-clash build && bun run scripts/bundleSizeCli.ts wit-clash`:

| File | Raw | Gzip |
|---|---:|---:|
| `assets/index-*.js` | 386,060 B | 118,591 B |
| `assets/index-*.css` | 47,996 B | 12,314 B |
| **Total (JS + CSS)** | **434,056 B** | **130,905 B** |

(Fonts and `index.html` are emitted too but excluded from the budget.) Top modules by pre-minify size, from a one-off `rollup-plugin-visualizer` run:

| Module | Raw | Gzip |
|---|---:|---:|
| `@colyseus/schema/build/index.mjs` | 174,915 B | 36,213 B |
| `zod/v4/core/schemas.js` | 40,120 B | 8,244 B |
| `msgpackr/pack.js` | 34,319 B | 7,691 B |
| `msgpackr/unpack.js` | 32,145 B | 7,404 B |
| `zod/v4/core/json-schema-processors.js` | 23,809 B | 5,419 B |
| `zod/v4/classic/schemas.js` | 23,379 B | 4,258 B |
| `uqr/dist/index.mjs` (QR codes for room links) | 19,394 B | 5,316 B |
| `svelte/src/internal/client/reactivity/batch.js` | 17,282 B | 4,303 B |
| `zod/v4/core/to-json-schema.js` | 15,595 B | 4,386 B |
| `zod/v4/core/util.js` | 15,191 B | 4,402 B |

By package: `@colyseus/schema` 22.5%, `zod` 21.2%, `svelte` 18.2%, wit-clash source 11.1%, `@colyseus/sdk` 8.5%, `msgpackr` 8.4%, framework packages (`game-client`, `game-ui`, `shared`) 7.5%, `uqr` 2.4%. No server-only code reaches the client bundle: `@colyseus/core`, `xstate` and `@partygame/core` are all absent; `@colyseus/schema` is present because the client SDK deserializes schema state (it is a shared wire-format library, not server code).

`@partygame/shared`, `@partygame/game-client` and `@partygame/game-ui` declare `"sideEffects": false` — verified by scanning their sources: no top-level calls, no global writes, no CSS imports; the only initializer expressions are pure object constructions (`new RegExp`, schema objects). For wit-clash this changed nothing (byte-identical output): it uses every exported component, so there was no unused module to drop. The field still lets a future game that imports a subset tree-shake the rest.

Follow-ups for later work (not done here): `@colyseus/schema` is a single 174,915 B module — about 45% of the final JS — and `zod` totals 21.2%; both are candidates for slimming (e.g. dropping zod's JSON-schema processors from the client path).

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
| `@partygame/shared` | `NAME_MAX_LENGTH`: the cap `SET_NAME` enforces on player names; `MAX_SEATS`: the most playerIds a room's `seats` option may list; `MAX_OPTIONS_JSON_LENGTH`: the cap on serialized options at room creation and in `SET_OPTIONS`; `ROOM_CODE_LENGTH` and `ROOM_CODE_ALPHABET`: the shape of a room code; `sanitizeRoomCode(raw)`: uppercases, drops other characters and cuts to the code length (for a code input); `FRAMEWORK_VERSION`: recorded in exported replay bundles |
| `@partygame/client-utils` | `Parsed<T>` (`{ ok: true, value } \| { ok: false, error }`) and `between(value, min, max)` for argument parsing; `waitFor(predicate, what, timeoutMs)` poll loop; `resolveRoomCode(apiBase, code)` (rejects with `RoomCodeError`, `reason` `"not-found"` or `"bad-reply"`); `joinUrl(base, code)` / `tvUrl(base, code)` share links; `claimName(room, playerId, name, timeoutMs?)` (type `SeatRoom`), `apiBaseOf(endpoint, apiPort)` |
| `@partygame/core` | `shuffle(items, rng)`, `required(value, what)`; roster guards: `seatedCount(ctx)` (active and ready seats, counting briefly disconnected ones), `isBelowMinimum(ctx, min)`, `departedIds(ids, ctx)` — they only report; the game writes its own notice and decides to end |
| `@partygame/core/kits` | Phase kits (`@experimental`). collectResponses: `allResponded(slots, responses, presentIds)` (complete when every present author responded to every slot), `entriesFor(slotId, slots, responses)` (one entry per author, `text` undefined when unanswered); types `Slots`, `Responses`. voteAndTally: `tallyVotes(voterIds, votes)`, `allHaveVoted(voterIds, votes)`, `countVoted(voterIds, votes)`, `eligibleVoters(activeIds, excludedIds)` (an empty exclusion list allows self-vote), `leaders(counts)` → `{ top, ids }` (a tie shows up as `ids.length > 1`). drawPool: `drawPool(items, usedIds, needed)` → `{ items, exhausted }` — the unused items when at least `needed` remain, otherwise all items with their ids cleared from the mutable `usedIds` set |
| `@partygame/server/node` | `startNodeServer({ games, port?, apiPort? })` (a game server and its API in this process; `.stop()`), `serveApi(codes, { port, host? })`: the code API on Node's `http` (the Bun entry serves its own) |
| `@partygame/server/probe` | `ServerProbe` (`isGameServer(port, apiPort)`, `canConnect(port)`, `answers(url)`), `freePort()`, `closeHttpServer(server)` (resolves when the server already stopped): port probing without Colyseus |
| `@partygame/content` | `loadJsoncDir(dir, schema, { idOf, label, onInvalid?, maxFiles?, maxFileBytes? })`: a folder of commented JSON files (symlinks ignored), validated; bad files throw by default (`onInvalid: "skip"` warns and skips), caps at 256 files / 1 MiB per file; `stripJsonComments` |
| `@partygame/content/filter` | `createTextFilter()`: a `TextFilter` over the English obscenity dataset — `check(text, "off" \| "moderate" \| "strict")` returns `{ ok: true }` or `{ ok: false, reason }`; moderate blocks slurs and profanity, strict adds mild terms; the reason is a fixed per-level string that never names the matched word |
| `@partygame/game-client` | `resolveEndpoints(overrides, pageHost)`, `readCodeParam(search, "code" \| "tv")` |
| `@partygame/game-client/test-setup` | vitest `setupFiles` entry for jsdom: storage shims, SDK on `ws` (repo-internal, raw `.ts`) |
| `@partygame/game-kit` | types: `GameMeta` (`roomName`, `minPlayers`, `maxPlayers`), `ServeOptions` (`games`, `port?`, `apiPort?`), `GameDemoOptions` (the declaration's `demo` field, see All-bot demo run) |

## Security checklist for game authors

The framework validates everything that crosses the wire, but the rules are yours. Eight habits keep a game safe; each example is taken from `games/wit-clash` and cited.

1. **Declare options with a bounded zod schema, and read them only through `ctx.options`.** The host changes options via the built-in `SET_OPTIONS`, which merges the update and re-parses it against your schema — out-of-range values are rejected, not clamped.
   ```ts
   export const WitClashOptionsSchema = z.object({
     totalRounds: z.number().int().min(1).max(10).default(3),
     promptSeconds: z.number().int().min(15).max(600).default(90),
   });
   ```
   (`games/wit-clash/src/options.ts`)

2. **Per-player secrets go in `ctx.priv` or a `.view()` field — never a plain synced field.** Plain fields are broadcast to every client; `.view()` entries reach only the players you reveal them to, and the room re-applies views on reconnect, so hide before you delete.
   ```ts
   const created = new PlayerPrivate();
   this.ctx.state.mine.set(playerId, created);
   this.ctx.showTo(playerId, created);
   // ... later, in pruneDeparted:
   this.ctx.hideFrom(playerId, entry);
   state.mine.delete(playerId);
   ```
   (`games/wit-clash/src/round.ts`, `mineOf` and `pruneDeparted`; see also `packages/server/README.md`, Private views)

3. **Every action has a payload schema with length and range limits; handlers use the parsed `ctx.payload`, never the raw message.** A message that fails validation is rejected before your handler runs.
   ```ts
   export const SubmitAnswerSchema = z.object({
     matchupId: z.string().min(1).max(64),
     answer: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
   });
   // in the handler:
   const { matchupId, answer } = ctx.payload;
   ```
   (`games/wit-clash/src/actions.ts`, `games/wit-clash/src/phases/answering.ts`)

4. **Do not mutate `payload` or shared state objects you did not create — copy first.** Synced entries are shared with every other code path, so pass copies into helpers and keep your scratch edits private.
   ```ts
   const options = [...ctx.state.categoryOptions].map((o) => ({ id: o.id, votes: o.votes }));
   const winner = resolveCategoryVote(options, ctx.rng);
   ```
   (`games/wit-clash/src/phases/CategorySelection.ts`, `resolve`)

5. **Use `ctx.rng()` and `ctx.newId()` in rule code — never `Math.random()` or `crypto.randomUUID()`.** The room RNG is seeded per room and id counters are logged, so replays reproduce your shuffles and ids exactly (Determinism contract).
   ```ts
   answer.id = ctx.newId();
   // ...
   const winner = resolveCategoryVote(options, ctx.rng);
   ```
   (`games/wit-clash/src/phases/Prompting.ts`, `games/wit-clash/src/phases/CategorySelection.ts`)

6. **Treat every player-typed string (names, answers) as untrusted: render with Svelte text interpolation, never `{@html}`; cap its length; do not log it.** Text interpolation escapes automatically — no screen in this repo uses `{@html}` for player content.
   ```svelte
   <figcaption class="best-prompt">{best.promptText}</figcaption>
   <blockquote class="best-text">{best.text}</blockquote>
   <span class="best-author">{`by ${best.authorName}${best.isMine ? " (you)" : ""}`}</span>
   ```
   (`games/wit-clash/ui/screens/Results.svelte`; caps: `NAME_MAX_LENGTH`, `ANSWER_MAX_LENGTH`)

7. **Check the sender.** Every handler verifies the acting player may do this in this phase, and rejects with a client-safe message. The host-only built-ins are `START_GAME`, `KICK_PLAYER`, `SET_OPTIONS` and `END_GAME`; everything else is yours to gate.
   ```ts
   const assigned = ctx.priv.assignments.get(ctx.playerId);
   if (!assigned?.includes(matchupId)) {
     ctx.reject(ErrorCode.NOT_ALLOWED, "That prompt was not assigned to you");
     return;
   }
   ```
   (`games/wit-clash/src/phases/answering.ts`)

8. **Know the limits.** `playerId` is the only seat credential: a client can send any action, but the server acts on `ctx.playerId`, which it assigned itself. There is no built-in rate limiting; the threat model that spells this out is planned work (#89).
   ```ts
   const drafts = ctx.priv.drafts.get(ctx.playerId) ?? new Map<string, string>();
   ctx.priv.drafts.set(ctx.playerId, drafts.set(matchupId, answer));
   ```
   (`games/wit-clash/src/phases/answering.ts`; caps in `packages/shared/src/limits.ts`)
