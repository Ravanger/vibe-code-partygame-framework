# @partygame/config

## Responsibility

Shared build, test, svelte and tsconfig presets every package and game extends.

## Never put here

- Runtime code that ships to players or servers.
- Game-specific settings.
- Any `@partygame/*` import; it stays dependency-free.

## May import

- Runtime: none
- Dev: none

## Public entry points

- `./vite`: `defineGameViteConfig`.
- `./vitest`: `uiTestConfig`, `nodeTestConfig`.
- `./node-test-setup`, `./svelte`.
- `./tsconfig.base.json`, `./tsconfig.game.json`.

## Tests

`tests/`, plain vitest; the presets are asserted directly.

## Before you add a file

Is it tooling config shared by 2+ packages? One package's own setting stays in that package.
