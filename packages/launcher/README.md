# @partygame/launcher

Unified launcher: game server, code-resolution API, browser client (dev/prod), optional bots and demo, all in one.

| Import | What |
|---|---|
| `@partygame/launcher` | `runLauncher(config, argv)`; `Launcher`, `ProcessGroup`, `StaticSite`, `parseLaunchArgs`, `lanUrls`, `openBrowser`; types `LaunchConfig`, `LaunchMode` |

## Launch a game

A game's `launch.ts` is only config. `gameDir` is the folder that holds the game.

```ts
import { fileURLToPath } from "node:url";
import { runLauncher } from "@partygame/launcher";

await runLauncher(
  { name: "FirstToPress", gameDir: fileURLToPath(new URL(".", import.meta.url)) },
  process.argv.slice(2),
);
```

`gameDir` must contain `server.ts` (run with env `PORT` and `API_PORT`), a `package.json` with `dev` and `build` scripts, and (for `prod`) the built `dist/`. `bun run launch <game>` runs it through `scripts/game.ts`.

## Modes and flags

| Argument | What |
|---|---|
| `dev` (default) | game server (2567), API (3001) and Vite with hot reload (5173) |
| `host` | the same, plus the LAN addresses guests join on |
| `prod` | build, then serve `dist/` on 3000 |
| `--no-browser` | do not open a browser tab |
| `--bots[=N]` | open a room for you and seat N bots once you have entered your name |
| `--demo[=N]` | a watch-only room that N bots plus a host bot play alone; the browser opens its TV view. Excludes `--bots` |

The launcher refuses to start when a port is taken, stops everything on Ctrl+C and exits 1 if a service dies.

## Enable `--bots`

Pass the bot kit from `@partygame/bots`. A flag for a missing option prints the usage and exits 2.

```ts
await runLauncher(
  {
    name: "FirstToPress",
    gameDir: fileURLToPath(new URL(".", import.meta.url)),
    bots: { kit: buttonKit, max: 7, default: 3 },
  },
  process.argv.slice(2),
);
```

## Enable `--demo`

`create` receives `endpoint`, `apiPort`, `bot` (the launcher's logger) and `bots` (the count, between `min` and `max`); pass them to `DemoTable`.

```ts
import { DemoTable } from "@partygame/bots";

await runLauncher(
  {
    name: "FirstToPress",
    gameDir: fileURLToPath(new URL(".", import.meta.url)),
    bots: { kit: buttonKit, max: 7 },
    demo: {
      min: 2,
      max: 7,
      create: (options) =>
        new DemoTable({ ...buttonKit, ...options, isFinished: (state) => state.phase === "Done" }),
    },
  },
  process.argv.slice(2),
);
```

## Tune the config

All optional: `ports` (`game` 2567, `api` 3001, `clientDev` 5173, `production` 3000), `commands` (`server`, `dev`, `build`; each a command array), `readyTimeoutMs` (30000), `openBrowser(url)` and `log(line)`.

```ts
{ name: "FirstToPress", gameDir, ports: { clientDev: 5200 }, commands: { build: ["bun", "run", "build"] } }
```

Depends on: `@partygame/bots`, `@partygame/server`, `@partygame/shared`

Guide: [docs/framework/README.md#launcher](../../docs/framework/README.md#launcher)
