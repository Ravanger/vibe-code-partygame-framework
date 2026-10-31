# @partygame/core

Pure game runtime (no Colyseus, no I/O): define phases and rules, dispatch actions, own the clock.

| Import | What |
|---|---|
| `@partygame/core` | `defineGame`, `actionFactory`, `GameRuntime`; join control `evaluateJoin(definition, input)` (the pure evaluation of the definition's optional synchronous `canJoin` hook; types `CanJoinInput`, `CanJoinResult`, `JoinGate`); `CoreStrings`, `defaultCoreStrings`; the logging types `Logger`, `ContextLogger`, `LogLevel`, `LogFields`, `LogLine` and the no-op `noopLogger` (see the guide's Logging section); `leaderboard`, `composeLeaderboard`, `awardPoints`; roster guards `seatedCount(ctx)`, `isBelowMinimum(ctx, min)`, `departedIds(ids, ctx)`; `shuffle`, `required`; seeded RNG `sfc32`, `Seed`, `randomSeed`, `seedFromNumber`, `mulberry32`, `newId`; action-log validation `ActionLogSchema`; middlewares `actionLogMiddleware()` (append-only, JSON-serializable record of every middleware-visible event kept outside `ctx.priv`, read back with `getActionLog(priv)`), `loggingMiddleware()` (one console line per enter/timeout/action/transition; none for roster changes), `timingMiddleware()` (per-phase timing records kept outside `priv`, read back with `getPhaseTimings(priv)`) and `textFilterMiddleware(filter)` (rejects an action whose declared text fields fail the room's filter level; see the guide's Phase middleware section) |
| `@partygame/core/awards` | `AwardDefinition` (`{ id, title, reduce(entries, roster), higherIsBetter? }` — a pure reducer over action-log entries), `computeAwards(log, defs)` → `AwardResult[]` (`{ id, title, scores, winners }`, ties shared, no winner for an empty score map); rejected log entries are filtered out before the reducers run |
| `@partygame/core/kits` | Phase kits (`@experimental`). collectResponses: `allResponded(slots, responses, presentIds)`, `entriesFor(slotId, slots, responses)`, types `Slots`, `Responses`. voteAndTally: `tallyVotes(voterIds, votes)`, `allHaveVoted(voterIds, votes)`, `countVoted(voterIds, votes)`, `eligibleVoters(activeIds, excludedIds)`, `leaders(counts)` → `{ top, ids }`. drawPool: `drawPool(items, usedIds, needed)` → `{ items, exhausted }` (on exhaustion it clears the drawn ids from the mutable `usedIds`) |
| `@partygame/core/replay` | `replayLog(definition, log, init)` (re-drives a fresh runtime over a recorded action log, returns state snapshots), `ReplayHost` (minimal `RuntimeHost`: manual clock, seats, given seed); replay bundles: `createBundle(parts)`, `parseBundle(json)`, `hashBundle(bundle)` (sha-256 hex of canonical JSON), `verifyBundle(bundle)`, `ReplayBundleSchema` |
| `@partygame/core/testing` | `FakeHost` (manual clock, in-memory seats; captures every `ctx.log` line in `logs`), `TestTable` (scenario boilerplate); re-exports `replayLog` from `./replay` |

## Define a game

Named phases, each with optional `onEnter`, `duration` + `onTimeout`, `onTick(ctx, dtMs)` (real-time phases; rate and determinism rules in the guide's Timers section), `onRosterChange` and `actions`. `Lobby` is built in; `startPhase` is where `START_GAME` goes. Move between phases only with `ctx.transition("Name")`.

```ts
import { actionFactory, defineGame } from "@partygame/core";
import { z } from "zod";

interface ButtonState { phase: string; phaseEndsAt: number; canStart: boolean; winner: string }
interface Priv { presses: string[] }

const action = actionFactory<ButtonState, Priv, Record<string, unknown>>();

export const ButtonGame = defineGame<ButtonState, Priv>({
  name: "FirstToPress",
  minPlayers: 2,
  maxPlayers: 8,
  startPhase: "Round",
  createPrivateState: () => ({ presses: [] }),
  phases: {
    Round: {
      duration: 10_000,
      onEnter: (ctx) => ctx.activateWaitingPlayers(),
      onTimeout: (ctx) => ctx.transition("Done"),
      actions: {
        PRESS: action({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.priv.presses.push(ctx.playerId);
            ctx.state.winner = ctx.playerId;
            ctx.transition("Done");
          },
        }),
      },
    },
    Done: { duration: 3_000, onTimeout: (ctx) => ctx.returnToLobby() },
  },
});
```

`defineGame` throws a `GameDefinitionError` listing every problem; `START_GAME`, `KICK_PLAYER`, `SET_OPTIONS` and `END_GAME` are built-in action names.

## Localisation

Every message the core owns (the lobby built-ins' refusals, the failure notice in `state.notice`, the stopped-runtime error and the runtime's refusal log messages) comes from `defaultCoreStrings`. Pass a partial table as the definition's `strings` field to replace any of it; `defineGame` fills in the defaults:

```ts
const game = defineGame<ButtonState, Priv>({
  // ...
  strings: { cannotKickSelf: "Du kannst dich nicht selbst rausschmeißen" },
});
```

Function entries receive their arguments (`needAtLeast(minPlayers)`, `notAllowedToSend(action)`). The client-visible entries reach players in `ERROR` payloads or `state.notice`; the log-only ones are `FrameworkError` messages, where clients see the fixed `CLIENT_MESSAGES` text for the code. Game-owned text (your own `ctx.reject` messages) is not part of this table.

## Actions

`from` is `"host"`, `"player"` or `"audience"`. An audience action is dispatched seatless through `runtime.dispatchAudience(audienceKey, raw)`: its handler gets no `playerId`, but an `audience.once(scope)` check that returns `true` once per key and scope (cleared on every phase change). See the framework guide's Audience section. `payload` is a zod schema for the whole action object, read in the handler as `ctx.payload`. `ctx.reject` sends the actor an `ERROR` but does not stop the handler, so return after it.

```ts
import { ErrorCode } from "@partygame/shared";

handler: (ctx) => {
  if (ctx.state.winner !== "") return ctx.reject(ErrorCode.NOT_ALLOWED, "Too late");
  ctx.state.winner = ctx.playerId;
},
```

## Context

`ctx.state` is synced to every client; `ctx.priv` stays on the server. Key maps by `playerId`. Seats: `ctx.players()`, `ctx.activePlayers()`, `ctx.player(id)`. Per-player state goes in a `.view()` field, revealed with `ctx.showTo(playerId, entry)`. `ctx.options` is the room options parsed by the definition's `options` schema; `ctx.rng()` and `ctx.now()` keep rules testable.

## Score points

```ts
import { awardPoints, composeLeaderboard, leaderboard } from "@partygame/core";

const scores: Record<string, number> = {};
awardPoints(scores, "p1", 100);
leaderboard(scores); // [{ playerId, score }], best first
composeLeaderboard({ scores, seatedNames: new Map([["p1", "Ann"]]), rememberedNames: {} });
// adds name and hasLeft; seated players first, then leavers
```

## Test phases without a server

`TestTable` seats `p1..pN` (`p1` hosts) on a `FakeHost` with a manual clock and drives the real runtime. Extend it with scenario steps.

```ts
import { TestTable } from "@partygame/core/testing";

class ButtonTable extends TestTable<ButtonState, Priv, Record<string, unknown>> {
  constructor() {
    super({
      definition: ButtonGame,
      state: { phase: "", phaseEndsAt: 0, canStart: false, winner: "" },
      options: {},
    });
  }
  press(id: string): void {
    this.act(id, "PRESS");
  }
}

const table = new ButtonTable();
table.start();                       // p1 sends START_GAME
table.press("p2");
expect(table.phase).toBe("Done");
table.tick(3_000);                   // advance the clock
expect(table.phase).toBe("Lobby");
```

Without `TestTable`, drive `new GameRuntime({ definition, state, options, host })` over a `FakeHost` (`host.seat("p1")`, `runtime.dispatch("p1", { type: "PRESS" })`, `host.advance(ms)`, `host.errorsTo("p1")`).

Depends on: `@partygame/content` (types only), `@partygame/shared`, `xstate`, `zod`

Guide: [docs/framework/README.md#concepts](../../docs/framework/README.md#concepts) ([minimal game](../../docs/framework/README.md#minimal-game-first-to-press-the-button), [testing](../../docs/framework/README.md#unit-testing-phases-without-a-server))
