# @partygame/bluff

## Responsibility

Headless rules spike for a bluffing party game (fake answers to a hidden-truth prompt; vote on which answer is real). Proves the framework hosts an asymmetric-information archetype (#156); UI, bots and terminal arrive in follow-up issues.

## Never put here

- Reusable framework code (move it to the matching `packages/` package and file a gap issue).
- Imports from other games.
- Framework changes (file the gap instead of contorting the game).

## May import

- Runtime: `@partygame/content`, `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- None yet (headless spike; server and launch entries are restored in #157).
- Content: `content/prompts/*.jsonc`.

## Tests

`tests/game/` (rules, `Table extends TestTable`).
