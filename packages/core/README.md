# @partygame/core

Pure game runtime (no Colyseus, no I/O): define phases and rules, dispatch actions, own the clock.

| Import | What |
|---|---|
| `@partygame/core` | `defineGame`, `actionFactory`, `GameRuntime`; `leaderboard`, `composeLeaderboard`, `awardPoints`; `shuffle`, `required` |
| `@partygame/core/testing` | `FakeHost` (manual clock, in-memory seats), `TestTable` (scenario boilerplate) |

## Define a game

Named phases, each with optional `onEnter`, `duration` + `onTimeout`, `onRosterChange` and `actions`. `Lobby` is built in; `startPhase` is where `START_GAME` goes. Move between phases only with `ctx.transition("Name")`.

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

## Actions

`from` is `"host"` or `"player"`. `payload` is a zod schema for the whole action object, read in the handler as `ctx.payload`. `ctx.reject` sends the actor an `ERROR` but does not stop the handler, so return after it.

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

Depends on: `@partygame/shared`, `xstate`, `zod`

Guide: [docs/framework/README.md#concepts](../../docs/framework/README.md#concepts) ([minimal game](../../docs/framework/README.md#minimal-game-first-to-press-the-button), [testing](../../docs/framework/README.md#unit-testing-phases-without-a-server))
