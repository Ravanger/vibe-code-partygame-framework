# @partygame/game-kit

The dev-side game declaration. A game declares itself once with `defineGamePackage` and its entry files become one-line stubs that call the kit's entry functions. Dev-side only: no browser package depends on it.

## API

### `defineGamePackage(declaration)`

Types and returns a `GameDeclaration`: `meta` (the browser-safe `{ roomName, minPlayers, maxPlayers }`), an optional `load(env)` for server-side content, `definition(content)`, `stateClass`, `isFinished(state)`, `botKit`, and optional `displayName`, `terminal` and `demo`.

### `hostedGame(pkg, content)`

The `HostedGame` a server hosts: `meta.roomName`, `definition(content)` and `stateClass`.

### `serve(pkg, { gameDir }, io?)`

Loads the content (`pkg.load` with `io.env`, or `undefined`), builds the hosted game and starts the Bun game server plus code API on `PORT`/`API_PORT` from `io.env` (defaults 2567/3001).

### `launch(pkg, { gameDir }, io?)`

Builds a `LaunchConfig` from the declaration — `name` from `displayName` (or `meta.roomName`), `bots` capped at `maxPlayers - 1`, a demo table between `minPlayers - 1` and `maxPlayers - 1` bots finished by `isFinished` — and runs it with `io.argv`.

### `buildLaunchConfig(pkg, { gameDir })` / `demoTableOptions(pkg, connection)`

The pure parts of `launch`: the `LaunchConfig`, and the per-connection `DemoTableOptions` its demo tables are built from — the declaration's `demo` extras (kit, room options, host name, bot pacing) merged under the connection's.

### `botsCli(pkg, io?)`

The `bots <CODE> [count]` entry: seats bots in a room made elsewhere (usage bounded by `meta.maxPlayers - 1`). The SIGINT handler removes them and exits 0; bad arguments or a failed join exit 1.

### `play(pkg, io?)`

The `play` entry: one human at a terminal driven by `pkg.terminal`, optionally with bots; starts a server when the endpoint defaults are used and no room is joined. Exit 2 on bad arguments, 1 on failure or when the game has no `terminal`.

### `demoCli(pkg, io?)`

The `demo` entry: one all-bot game on its own server with a PASS/FAIL verdict. `--bots=` defaults to 3 and must stay within `meta.minPlayers - 1 .. meta.maxPlayers - 1` (exit 2 otherwise); the declaration's `demo` extras feed the run; exit 0 on PASS, 1 on FAIL.

### `GameKitIo`

The injectable process: `env`, `argv`, `exit`, `log`, `error`, `onSignal` and the `startServer`/`runLauncher` seams. Defaults to `process` via `defaultIo()`, so tests pass fakes and never touch a real process.
