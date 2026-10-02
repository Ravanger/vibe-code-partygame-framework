# Party Game Framework: game author guide

You describe a game as data: phases, the actions players may send in each phase, and optional timers.
The framework supplies the lobby, room, roster, reconnection, timers and wire protocol.

Dependency direction: `games/* -> @partygame/server -> @partygame/core -> @partygame/shared`.

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
| `NOT_ENOUGH_PLAYERS` | `START_GAME` below `minPlayers` |
| `NOT_ALLOWED` | game rule; use `ctx.reject("NOT_ALLOWED", "why")` in a handler |
| `NAME_TAKEN` | `SET_NAME` with a name another seat already has (compared trimmed and case-insensitively); the seat keeps its name |
| `KICKED` | pushed to a player the host removed, just before the connection closes |
| `INTERNAL` | only ever the answer to a request: a hook threw while handling the action |

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
- `SET_OPTIONS { ...partial }`: Lobby only. The partial is merged into the current options and validated with `definition.options`
  (`INVALID_ACTION` on failure), then published. `ctx.options` reflects the new value.

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

### Errors at definition time
`defineGame` throws `GameDefinitionError` listing every problem: reserved or unknown phase names, missing `startPhase`,
`duration` without `onTimeout`, bad player limits, bad action names.
A `ctx.transition()` to an undeclared phase throws at the call site.

## Minimal game: first to press the button

```ts
import { actionFactory, defineGame } from "@partygame/core";
import { z } from "zod";

interface State { phase: string; phaseEndsAt: number; canStart: boolean; winner: string }
interface Priv { presses: string[] }

const action = actionFactory<State, Priv, Record<string, unknown>>();

export const ButtonGame = defineGame<State, Priv>({
  name: "FirstToPress",
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

### Structuring a bigger game
Keep each phase in its own file exporting a `PhaseDefinition`, and let `defineGame` only assemble them. Put decisions that need no
context (pairing, scoring, eligibility, tallies) in pure functions that take plain data and the rng, so they are testable
without the runtime; phases are thin glue that reads the context, calls them, and writes the state. Export phase and action
names from constants so server and UI share them, and build actions with `actionFactory<State, Private, Options>()` once per
game so each handler's `payload` is inferred from its zod schema. `games/wit-clash/src` is the worked example.

## Server

`@partygame/server` hosts any game on Colyseus. Your state class extends `BaseGameState` (`phase`, `phaseEndsAt`, `roomCode`,
`serverNow`, `spectatorCount`, `options` as JSON, `minPlayers`, `maxPlayers`, `players` keyed by `playerId`).
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

Elsewhere: `createGameServer({ games, roomCodeService?, transport?, reconnectMs?, emptyRoomGraceMs? })` returns the Colyseus `Server`,
and `createApiHandler(roomCodeService)` is the pure `(Request) => Response` behind `/api/resolve-code`.

Clients join with `{ playerId, name? }` (`spectator: true` for a TV display: no seat, counted in `spectatorCount`).
Create a watch-only room with the framework option `seats: string[]` (the playerIds allowed to take a seat): any other non-spectator join is refused with `4403 "This room is watch-only"`, spectators still join. It is not a game option and is not published in `state.options`.
`SET_NAME` readies a seat (a name another seat has is refused with `NAME_TAKEN`; a join-time `name` that is taken is ignored and the seat joins unnamed). A room is kept alive only by connected seats: once the last one is gone for `emptyRoomGraceMs`, the room is disposed and any spectators are disconnected. `ACTION` carries your actions (`room.send` or `room.request`, see Actions). A dropped connection holds the seat for `reconnectMs`
(token reconnect or a new session with the same `playerId`); a mid-game joiner is seated inactive.
When the host leaves or drops, the role moves to a connected seat that is active and ready, else one that is ready, else any connected seat.
Spectators get no reconnection window; they simply rejoin.

### Private state with StateView
Tag a synced field `.view()`, put per-player entries in it, and reveal each with `ctx.showTo(playerId, entry)`;
`ctx.hideFrom` revokes. The room remembers what each player may see and re-applies it on every reconnect, so nothing is resent.
Call `hideFrom` before you delete an entry, or the room will try to re-add it on reconnect.

### Testing a game
```ts
import { bootTestServer, waitUntil, collectMessages } from "@partygame/server/testing";

const t = await bootTestServer({ games });            // free port, default transport, short reconnect window
const room = await t.createRoom("button");            // server-side Room: inspect room.state
const alice = await t.join(room, { playerId: "player-0001" });
alice.send("SET_NAME", "Alice");
alice.send("ACTION", { type: "PRESS" });
await waitUntil(() => room.state.phase === "Done", "finished");
await t.shutdown();                                    // t.cleanup() between tests
```
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
});
manager.onMessage("FIRST", (payload) => { /* register pushed messages before connecting */ });
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
| `onMessage(type, cb)` | returns an unsubscribe function; survives room changes |
| `countdown()` | a `Countdown` (`secondsLeft`, `isUrgent`, `isExpired`, `destroy()`) to `phaseEndsAt`, corrected for client clock skew |
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
Rejections are also kept in `lastServerError`. A transport failure (not connected, timeout, connection closed) resolves as
`{ ok: false, error: { code: "INTERNAL", ... } }`; it never throws.

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
`reconnected`, `closed` fire server events. Integration tests boot a real server with `bootTestServer` from `@partygame/server/testing`
(`t.endpoint`, and `await t.serveApi()` for the code-resolution API) and use real managers. Add `"@partygame/game-client/test-setup"` to the
vitest `setupFiles`: it shims the storages and makes the SDK use `ws` under jsdom.

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

## Terminal

`@partygame/terminal` lets a human play at a prompt. You write a `TerminalStrategy` (what to ask in each stage); `TerminalPlayer`
keeps the lobby, the countdown, action replies and quitting, and `PlaySession` finds or starts a server, creates or joins a room and
seats bots. Players are `BotRoom`s, so the same kit that drives bots names the room and state class. The samples here and in Launcher reuse `buttonKit`, `ButtonState` and `ButtonGame` from Bots and Minimal game.

```ts
import { createInterface } from "node:readline/promises";
import {
  PlaySession,
  ReadlinePrompter,
  TerminalPlayer,
  parsePlayArgs,
  type TerminalStrategy,
} from "@partygame/terminal";

const buttonTerminal = (): TerminalStrategy<ButtonState> => ({
  async play(turn) {
    if (turn.state.phase !== "Round") return;
    await turn.ask(`Press Enter to press!${turn.timeLeft()}`);
    await turn.send("PRESS", {}, "Pressed.");
    await turn.changed();
  },
  narrate: (state) => (state.phase === "Done" ? [`${state.winner} won`] : []),
});

const USAGE = "Usage: bun run play [--bots=0..7] [--name=You] [--join=ABCD]";
const parsed = parsePlayArgs(process.argv.slice(2), { maxBots: 7, usage: USAGE });
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const lines = createInterface({ input: process.stdin, output: process.stdout });
const { usesDefaults, join } = parsed.value;
const session = new PlaySession(
  {
    ...parsed.value,
    startServer: usesDefaults && join === undefined,
    kit: buttonKit,
    games: [{ roomName: "button", definition: ButtonGame, stateClass: ButtonState }],
    player: (room, playerId, io) => new TerminalPlayer(room, playerId, io, buttonTerminal()),
    clientUrl: "http://localhost:5173",
  },
  new ReadlinePrompter(lines),
);
process.on("SIGINT", () => session.stop());
await session.run();
lines.close();
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
(host: Enter starts, `q` quits). `TerminalPlayerOptions` takes `now` and `quitWord`. `parseBotsArgs`, `runBotsCommand` and
`ReadlinePrompter` back a game's `bots/cli.ts`; `@partygame/terminal/testing` has test doubles. Example:
`games/wit-clash/terminal/witClashTerminal.ts` and `play.ts`.

## Launcher

`@partygame/launcher` starts a game's server, the code API and the client (Vite or the built `dist/`) and optionally a bot table.
A game's `launch.ts` is only config:

```ts
import { fileURLToPath } from "node:url";
import { DemoTable } from "@partygame/bots";
import { runLauncher } from "@partygame/launcher";

await runLauncher(
  {
    name: "FirstToPress",
    gameDir: fileURLToPath(new URL(".", import.meta.url)),
    bots: { kit: buttonKit, max: 7 },
    demo: {
      min: 2,
      max: 7,
      create: ({ bot, ...connection }) =>
        new DemoTable({
          ...buttonKit,
          ...connection,
          ...(bot ? { bot } : {}),
          isFinished: (state) => state.phase === "Done",
        }),
    },
  },
  process.argv.slice(2),
);
```

`gameDir` holds `server.ts` (run with env `PORT` and `API_PORT`), a `package.json` with `dev` and `build` scripts, and the built `dist/`.
`bots` and `demo` are optional; a flag for a missing one prints the usage and exits 2. `create` receives the endpoint, API port, the
launcher's logger inside `bot`, and `bots` (the count).

| Argument | What |
|---|---|
| `dev` (default) / `host` / `prod` | Vite with hot reload on 5173 / the same plus the LAN addresses guests join on / build, then serve `dist/` on 3000 |
| `--no-browser` | do not open a browser tab |
| `--bots[=N]` | open a room for you and seat N bots (1 to `bots.max`, default `bots.default` or 3) once you have entered your name |
| `--demo[=N]` | a watch-only room that N bots plus a host bot play alone; the browser opens its TV view (`demo.min` to `demo.max`). Excludes `--bots` |

Overridable in the config: `ports` (`game` 2567, `api` 3001, `clientDev` 5173, `production` 3000), `commands` (`server`, `dev`, `build`),
`readyTimeoutMs` (30000), `openBrowser(url)`, `log(line)`. The launcher refuses to start when a port is taken, stops everything on
Ctrl+C and exits 1 if a service dies. The pieces (`Launcher`, `parseLaunchArgs`, `ProcessGroup`, `StaticSite`, `lanUrls`, `openBrowser`) are exported
for tests and custom launchers.

The repo root has no game code. `scripts/game.ts <command> [game] [...args]` runs `games/<game>/<entry>.ts` by convention:
`launch` runs `launch.ts`, `play` runs `terminal/play.ts`, `bots` runs `bots/cli.ts`. A game is a folder under `games/` with a
`package.json`. It is picked by the first argument when that names a game folder; otherwise the only game is used; with several games
and a terminal it asks (`Pick a game [1-N]:`; empty input or end of input exits 2), and without a terminal it prints the list and exits 2.
`bun run games` lists every game and the commands it has an entry for.
`bun run launch`, `launch:dev`, `launch:host`, `launch:prod`, `launch:bots`, `launch:demo`, `play` and `bots` all go through it:
`bun run launch my-game --demo`, or `bun run scripts/game.ts launch my-game dev --demo`. A missing entry prints
`<game> has no <command> entry (<path>)` and exits 2.

## Helpers

| Import | What |
|---|---|
| `@partygame/shared` | `Parsed<T>` (`{ ok: true, value } \| { ok: false, error }`) and `between(value, min, max)` for argument parsing; `waitFor(predicate, what, timeoutMs)` poll loop; `resolveRoomCode(apiBase, code)`; `joinUrl(base, code)` / `tvUrl(base, code)` share links; `NAME_MAX_LENGTH` |
| `@partygame/core` | `shuffle(items, rng)`, `required(value, what)` |
| `@partygame/server/node` | `startNodeServer({ games, port?, apiPort? })` (a game server and its API in this process; `.stop()`), `ServerProbe` (`isGameServer(port, apiPort)`, `canConnect(port)`, `answers(url)`), `freePort()`, `serveApi(codes, { port, host? })`: the code API on Node's `http` (the Bun entry serves its own) |
| `@partygame/server/content` | `loadJsoncDir(dir, schema, { idOf, label })`: a folder of commented JSON files, validated, duplicate ids refused; `stripJsonComments` |
| `@partygame/game-client` | `resolveEndpoints(overrides, pageHost)`, `readCodeParam(search, "code" \| "tv")` |
| `@partygame/game-client/test-setup` | vitest `setupFiles` entry for jsdom: storage shims, SDK on `ws` (repo-internal, raw `.ts`) |
