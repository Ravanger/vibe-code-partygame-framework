# @partygame/bots

Bot players for any game: you write the strategy, the package handles joining, naming, pacing, and hosting.

| Import | What |
|---|---|
| `@partygame/bots` | `joinBots`, `BotTable`, `DemoTable` to seat bots; types `BotStrategy`, `BotKit`, `BotRoom` for your game |

## Write a strategy

`play(turn)` runs on every state change. `once` runs a step the first time its key is seen in a phase, `later` delays it (cancelled on phase change), `act` sends an action.

```ts
import type { BotKit, BotStrategy } from "@partygame/bots";

const pressBot: BotStrategy<ButtonState> = {
  play: (turn) => {
    if (turn.state.phase === "Round") {
      turn.once("press", () => turn.later("react", () => turn.act("PRESS")));
    }
  },
};

export const buttonKit: BotKit<ButtonState> = {
  roomName: "button",
  stateClass: ButtonState,
  strategy: pressBot,
};
```

| `turn` member | What |
|---|---|
| `state`, `playerId`, `name` | the synced state and this bot |
| `once(key, run)` | runs `run` the first time `key` is seen in this phase |
| `later(speed, run)` | runs `run` after a `"think"`, `"react"` or `[min, max]` ms delay |
| `act(type, payload?, note?)` | sends an action; the result goes to `log` and `onOutcome` |
| `pick(items)` | a random item, `undefined` for an empty list |

## Act as the host

A bot created with `bot: { host: { expectedPlayers } }` is the host: it sends `START_GAME` once `canStart` holds and that many seats are named, then runs the optional `host(turn)` on every state change, before `play`.

```ts
const strategy: BotStrategy<ButtonState> = {
  play: pressBot.play,
  host: (turn) => {
    if (turn.state.phase === "Lobby") turn.once("options", () => turn.act("SET_OPTIONS", { rounds: 3 }));
  },
};
```

## Seat bots in a room

All entry points take the kit plus `endpoint` and `apiPort`.

```ts
import { BotTable, joinBots } from "@partygame/bots";

const bots = await joinBots({ ...buttonKit, endpoint, apiPort, code: "ABCD", count: 3 }); // an existing room

const table = new BotTable({ ...buttonKit, endpoint, apiPort });
const code = await table.open();         // empty room the table watches
await table.seatBots({ count: 3 });      // once a human has joined and named themselves
```

On failure `joinBots` leaves the seats it took.

## Run an unattended demo

`DemoTable` opens a watch-only room (room option `seats`) with a host bot, seats the bots and tells you when the game is over.

```ts
import { DemoTable } from "@partygame/bots";

const demo = new DemoTable({
  ...buttonKit,
  endpoint,
  apiPort,
  bots: 3,
  isFinished: (state) => state.phase === "Done",
});
await demo.open();
await demo.seatBots();
await demo.finished();   // rejects if the room closes
await demo.leave();
```

## Tune pacing

`BotOptions` (the `bot` option, or `bot` on the launcher's `create`): `thinkMs` (default `[2000, 6000]`), `reactMs` (`[500, 2500]`), `rng`, `schedule`, `log`, `onOutcome`, `host.expectedPlayers`. `joinBots` also takes `nameFor(n)` (default `Bot n`), `playerIds` and `timeoutMs`; `DemoTable` takes `hostName`, `roomOptions` and `isFinished`.

Depends on: `@partygame/shared`

Guide: [docs/framework/README.md#bots](../../docs/framework/README.md#bots)
