# @partygame/__slug__

## Responsibility

The __DisplayName__ game: rules, UI screens and entry points, built only on the framework packages.

## Never put here

- Reusable framework code (move it to the matching `packages/` package).
- Imports from other games.

## May import

- Runtime: `@partygame/bots`, `@partygame/core`, `@partygame/game-client`, `@partygame/game-ui`, `@partygame/launcher`, `@partygame/server`, `@partygame/shared`, `@partygame/terminal`
- Dev: `@partygame/config`

## Public entry points

- No `exports`. Entries: `server.ts`, `launch.ts`, `ui/main.ts`, `bots/cli.ts`, `terminal/play.ts`.

## Tests

`tests/game/` (rules), `tests/bots/`, `tests/terminal/`, and UI tests under `tests/`.
