# @partygame/wit-clash (reference game)

## Responsibility

The reference game: rules, UI screens, content and entry points, built only on the framework packages.

## Never put here

- Reusable framework code (hoist to `packages/`, moving: #62, #112, #137).
- Imports from other games.
- Hand-rolled server, bot, terminal or launch plumbing that game-kit will own (moving: #134, #135).

## May import

- Runtime: `@partygame/bots`, `@partygame/core`, `@partygame/game-client`, `@partygame/game-ui`, `@partygame/launcher`, `@partygame/server`, `@partygame/shared`, `@partygame/terminal`
- Dev: `@partygame/config`

## Public entry points

- No `exports`. Entries: `server.ts`, `launch.ts`, `ui/main.ts`, `bots/cli.ts`, `terminal/play.ts`.
- Content: `content/categories/*.jsonc`.

## Tests

`tests/game/` (rules, `Table extends TestTable`), `tests/viewmodels/`, `tests/screens/` (`StubRoom`).

## Before you add a file

Is it WitClash rules, screens or content? If another game could reuse it -> the matching package.
