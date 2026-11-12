# @partygame/crew

## Responsibility

The asymmetric co-op party game: private roles and signals per player, rounds of share/withhold choices, a shared win/lose on the crew's signal sum.

## Never put here

- Reusable framework code (move it to the matching `packages/` package and file a gap issue).
- Imports from other games.

## May import

- Runtime: `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`, `@partygame/server` (room-level isolation tests only)

## Public entry points

- No `exports`. Headless: no server, launch, bot or UI entries.

## Tests

`tests/game/` (rules, `Table extends TestTable`) plus a room-level view-isolation test through `@partygame/server/testing`.
