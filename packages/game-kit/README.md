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

### `GameKitIo`

The injectable process: `env`, `argv`, `exit`, `log`, `error`, `onSignal` and the `startServer`/`runLauncher` seams. Defaults to `process` via `defaultIo()`, so tests pass fakes and never touch a real process.
