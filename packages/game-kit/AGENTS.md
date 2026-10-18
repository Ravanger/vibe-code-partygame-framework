# @partygame/game-kit

## Responsibility

The dev-side game declaration: `defineGamePackage` plus the entry functions (`serve`, `launch`, `botsCli`, `play`, `demoCli`) that turn one declaration into a game's runnable entry files.

## Never put here

- Game rules, strategies, content or narration (they live in the game).
- Browser code; no browser package may depend on this one.
- Wiring that belongs to the package an entry calls (`server`, `launcher`, `terminal`, `bots`).

## May import

- Runtime: `@partygame/bots`, `@partygame/content` (types only: `TextFilter` for the declaration's filter field), `@partygame/core`, `@partygame/launcher`, `@partygame/server`, `@partygame/shared`, `@partygame/terminal`
- Dev: `@partygame/config`

## Public entry points

- `.`: `defineGamePackage`, `serve`, `launch`, `botsCli`, `play`, `demoCli`, `buildLaunchConfig`, `demoTableOptions`, `hostedGame`, the declaration and io types.

## Tests

`tests/`; a small fake game in `tests/fixtures/`, real servers via `@partygame/server/node` and `/testing`.

## Before you add a file

Does it wire a game's entry files, or does it belong to one of the packages it calls?
