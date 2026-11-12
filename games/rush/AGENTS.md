# @partygame/rush

## Responsibility

The real-time tap-race party game: a target bounces around a 10x10 grid on the server tick while players TAP for center-zone hits.

## Never put here

- Reusable framework code (move it to the matching `packages/` package and file a gap issue).
- Imports from other games.

## May import

- Runtime: `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- No `exports`. Headless: no server, launch, bot or UI entries.

## Tests

`tests/game/` (rules and deterministic motion, `Table extends TestTable`).
