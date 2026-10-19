# @partygame/rush

## Responsibility

The real-time tap-race party game (headless rules spike): a target bounces around a 10x10 grid on the server tick while players TAP for center-zone hits. No UI in this spike.

## Never put here

- Reusable framework code (move it to the matching `packages/` package and file a gap issue).
- Imports from other games.

## May import

- Runtime: `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- No `exports`. Headless spike: no server, launch or UI entries yet.

## Tests

`tests/game/` (rules and deterministic motion, `Table extends TestTable`).
