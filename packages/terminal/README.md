# @partygame/terminal

Terminal client: a human at a prompt, bots, or an all-bot demo run. You write the strategy.

- `@partygame/terminal`: `TerminalPlayer`, `PlaySession`, `ReadlinePrompter`, `DemoRun`, `parsePlayArgs`, `runBotsCommand`; types `TerminalStrategy`, `TerminalTurn`
- `@partygame/terminal/testing`: `ScriptedIo`, a scripted `Prompter`

## Write a strategy

`play(turn)` runs once per stage (the phase, unless you give `stageOf`) and not in the Lobby. When the stage changes, the turn's `signal` aborts and a pending `ask` or `changed` rejects, so no cleanup is needed.

```ts
import type { TerminalStrategy } from "@partygame/terminal";

export const buttonTerminal = (): TerminalStrategy<ButtonState> => ({
  async play(turn) {
    if (turn.state.phase !== "Round") return;
    await turn.ask(`Press Enter to press!${turn.timeLeft()}`);
    await turn.send("PRESS", {}, "Pressed.");
    await turn.changed();
  },
  narrate: (state) => (state.phase === "Done" ? [`${state.winner} won`] : []),
});
```

| `turn` member | What |
|---|---|
| `state`, `playerId`, `isHost`, `signal`, `quitWord` | context |
| `ask(question)`, `print(line)` | the trimmed answer (rejects when the stage ends); prints a line |
| `send(type, payload, accepted)` | sends an action, prints `accepted` or the refusal; resolves true when accepted |
| `notify(type, payload)` | sends without waiting or printing |
| `changed()` | resolves on the next state change or when the stage ends |
| `timeLeft()` | `" 12s left"` from the server clock, `""` without a deadline |
| `quit()` | leaves the game |

Optional: `stageOf(state)`; `narrate(state)` returns lines printed on every state change; `lobby(turn)` replaces the built-in lobby.

## Wire `terminal/play.ts`

`parsePlayArgs` reads `--bots`, `--name`, `--join`, `--endpoint`, `--api-port`. `PlaySession` finds or starts a server, creates or joins a room and seats bots from your `BotKit`.

```ts
import { createInterface } from "node:readline/promises";
import { PlaySession, ReadlinePrompter, TerminalPlayer, parsePlayArgs } from "@partygame/terminal";

const usage = "Usage: bun run play [--bots=0..7] [--name=You] [--join=ABCD]";
const parsed = parsePlayArgs(process.argv.slice(2), { maxBots: 7, usage });
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

## Wire `bots/cli.ts`

`bun run bots <CODE> [count]` seats bots in a room created in the browser.

```ts
import { runBotsCommand } from "@partygame/terminal";

await runBotsCommand({
  kit: buttonKit,
  maxBots: 7,
  argv: process.argv.slice(2),
  out: console.log,
  err: console.error,
  usage: "Usage: bun run bots <CODE> [count=3]",
  onInterrupt: (stop) => process.on("SIGINT", () => void stop().finally(() => process.exit(0))),
}).catch(() => process.exit(1));
```

## Check a game with an all-bot run

`DemoRun` plays one game on its own server and prints `PASS` or `FAIL`: it fails on a refused bot action, no finish within `timeoutMs` (default 180 s), or lines from the optional `problems(state)`.

```ts
import { DemoRun } from "@partygame/terminal";

const passed = await new DemoRun({
  games: [{ roomName: "button", definition: ButtonGame, stateClass: ButtonState }],
  kit: buttonKit,
  bots: 2,
  finished: (state) => state.phase === "Done",
  out: console.log,
}).run();
process.exit(passed ? 0 : 1);
```

## Test a strategy

`ScriptedIo` (from `@partygame/terminal/testing`) is a `Prompter` that records `asked` and `printed` lines; `await io.type("text")` answers the pending question. Pass it to `TerminalPlayer` or `PlaySession`.

Depends on: `@partygame/bots`, `@partygame/server`, `@partygame/shared`

Guide: [docs/framework/README.md#terminal](../../docs/framework/README.md#terminal)
