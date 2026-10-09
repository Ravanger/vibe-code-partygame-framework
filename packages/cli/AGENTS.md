# @partygame/cli

## Responsibility

The `create` command (`bun run new <slug>`) that scaffolds a tested game from `template/`.

## Never put here

- Framework runtime code other packages import.
- A template that drifts from the reference game (moving: #136, #137, #112).
- Runtime `@partygame/*` dependencies; the template's own `package.json` carries those.

## May import

- Runtime: none
- Dev: `@partygame/config`

## Public entry points

- No `exports`; `bin`: `partygame` (`src/cli.ts`, a coverage-excluded runner).

## Tests

`tests/`; scaffold into a temp dir and assert the output tree.

## Before you add a file

Does it generate or validate a scaffolded game? Reusable runtime -> the matching package.
