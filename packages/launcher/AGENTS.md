# @partygame/launcher

## Responsibility

`runLauncher(config, argv)`: starts a game's server, API and client (dev, host, prod) plus bot and demo tables.

## Never put here

- Game rules or game vocabulary.
- Port-probing primitives that belong in one shared place (moving: #99).
- Per-game scripts; a game supplies a `LaunchConfig` (moving: #134, game-kit `launch`).

## May import

- Runtime: `@partygame/bots`, `@partygame/server`, `@partygame/shared`
- Dev: `@partygame/config`, `@partygame/core`

## Public entry points

- `.`: `runLauncher`, `LaunchConfig`.

## Tests

`tests/`; pure parts are unit-tested, `runLauncher.ts` is a thin coverage-excluded runner.

## Before you add a file

Does it start or wire processes for a game? Playing or hosting a room -> `bots` / `server`.
