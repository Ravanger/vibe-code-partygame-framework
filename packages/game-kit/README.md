# @partygame/game-kit

The dev-side game declaration. A game declares itself once with `defineGamePackage` — what to host, how to launch it and who plays it — and its entry files become one-line stubs that call the kit's entry functions. Dev-side only: no browser package depends on it.

## Declaring a game

A game root holds `gamePackage.ts` (the declaration) and `src/meta.ts` (the browser-safe constants, imported by the UI so they stay out of the server-only definition):

```ts
// src/meta.ts
export const META = { roomName: "word_war", minPlayers: 2, maxPlayers: 8 } as const;
```

```ts
// gamePackage.ts
import { defineGamePackage } from "@partygame/game-kit";

export const gamePackage = defineGamePackage({
  meta: META,
  displayName: "Word War",
  load: (env) => loadWords(contentDir(env, import.meta.url)),
  definition: (words) => createWordWarGame({ words }),
  stateClass: WordWarState,
  isFinished: (state) => state.phase === PHASE.Results && state.isFinalRound,
  botKit: wordWarKit(),
  terminal: wordWarTerminal,
  demo: { roomOptions: { totalRounds: 2 }, bot: { thinkMs: [2000, 9000], reactMs: [1000, 4000] } },
});
```

`defineGamePackage` types and returns a `GameDeclaration` unchanged. Fields:

| Field | What |
|---|---|
| `meta` | the browser-safe `{ roomName, minPlayers, maxPlayers }` from `src/meta.ts`; bounds every entry's usage lines |
| `displayName?` | the launcher name; `meta.roomName` when omitted |
| `load?(env)` | loads server-side content from disk; without it `definition` is called with `undefined` |
| `definition(content)` | builds the `defineGame` result for the loaded content |
| `textFilter?` | the room's `TextFilter` (`@partygame/content/filter`); `serve` hands it to the server starter, which checks player names and the game's filtered actions |
| `stateClass` | the synced state class (a `BaseGameState` subclass) |
| `publicFields?` | the state's public fields, handed to the server as `HostedGame.publicFields`; a field neither listed here nor tagged `.view()` (fields of `BaseGameState` excepted) fails the server at startup |
| `isFinished(state)` | true once the game is over; the demo tables and the demo run watch for it |
| `botKit` | the game's `BotKit` (`roomName`, `stateClass`, `strategy`) |
| `terminal?` | `() => TerminalStrategy`; without it `play` prints "This game has no terminal strategy." and exits 1 |
| `demo?` | extras beyond the kit: `kit`, `roomOptions`, `hostName`, `bot` (pacing), `narrate(state)`, `problems(state)` and `passMessage` |

## Entry functions

Each entry file is a stub; only `launch` takes `gameDir`, the directory of the stub:

| Stub | Calls | What it does |
|---|---|---|
| `server.ts` | `serve(pkg)` | loads the content (`pkg.load` with `io.env`, or `undefined`), builds the hosted game and starts the Bun game server plus code API on `PORT`/`API_PORT` (defaults 2567/3001; `startServer` validates them as whole numbers 1-65535); a failure prints one line and exits 1 |
| `launch.ts` | `launch(pkg, { gameDir })` | builds a `LaunchConfig` from the declaration — `name` from `displayName` (or `meta.roomName`), bots capped at `maxPlayers - 1`, demo tables between `minPlayers - 1` and `maxPlayers - 1` bots finished by `isFinished` with the `demo` extras merged in — and runs it with `io.argv` |
| `bots/cli.ts` | `botsCli(pkg)` | seats bots in a room made elsewhere, `<CODE> [count]` bounded by `meta.maxPlayers - 1`; the SIGINT handler removes them and exits 0; bad arguments exit 2, a failed join exits 1 |
| `terminal/play.ts` | `play(pkg)` | one human at a terminal driven by `pkg.terminal`, optionally with bots; starts a server when the endpoint defaults are used and no room is joined; exit 2 on bad arguments, 1 on failure or when the game has no `terminal` |
| `terminal/demo.ts` | `demoCli(pkg)` | one all-bot game on its own server with a PASS/FAIL verdict; `--bots=` defaults to 3 and must stay within `meta.minPlayers - 1 .. meta.maxPlayers - 1` and is parsed by `parseDemoArgs` (only the `=` form; anything else exits 2); exit 0 on PASS, 1 on FAIL or when loading fails |

## Helpers

### `hostedGame(pkg, content)`

The `HostedGame` a server hosts: `meta.roomName`, `definition(content)`, `stateClass` and, when declared, `publicFields`.

### `buildLaunchConfig(pkg, { gameDir })` / `demoTableOptions(pkg, connection)`

The pure parts of `launch`: the `LaunchConfig`, and the per-connection `DemoTableOptions` its demo tables are built from — the declaration's `demo` extras (kit, room options, host name, bot pacing) merged under the connection's.

### `GameKitIo`

The injectable process: `env`, `argv`, `exit`, `log`, `error`, `onSignal` and the `prompter`/`startServer`/`runLauncher` seams, all required. `defaultIo()` binds the real process (readline prompter, Bun server starter, `runLauncher`), so entries have no process-bound branch and tests pass fakes. `serve`, `play` and `demoCli` print one line and exit 1 when loading content or running fails.

## Types

- `GameMeta`: room name and player bounds (`roomName: string`, `minPlayers: number`, `maxPlayers: number`).
- `ServeOptions`: config for `serve()` (`games: HostedGame[]`, `port?: number`, `apiPort?: number`, `textFilter?` — the declaration's filter).
- `GameDemoOptions`: the declaration's `demo` field (`kit?`, `roomOptions?`, `bot?`, `hostName?`, `narrate?`, `problems?`, `passMessage?`).
