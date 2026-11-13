# @partygame/bluff

## Responsibility

The bluffing party game: rules, UI screens, content and entry points, built only on the framework packages. A fake answer per player against a hidden-truth prompt; vote on which option is real.

## Never put here

- Reusable framework code (move it to the matching `packages/` package and file a gap issue).
- Imports from other games.

## May import

- Runtime: `@partygame/bots`, `@partygame/content`, `@partygame/core`, `@partygame/game-client`, `@partygame/game-kit`, `@partygame/game-ui`, `@partygame/shared`, `@partygame/terminal`
- Dev: `@partygame/config`, `@partygame/server`

## Public entry points

- No `exports`. Entries: `server.ts`, `launch.ts`, `bots/cli.ts`, `terminal/play.ts`, `terminal/demo.ts`.
- Content: `content/prompts/*.jsonc` packs, listed in `content/provenance.json`.

## Tests

`tests/game/` (rules, `Table extends TestTable`), `tests/bots/`, `tests/terminal/` (the terminal strategy plus a full PlaySession game against an in-process server), and UI tests under `tests/` (viewmodels and screens through the game-client test client).
