# @partygame/game-ui

## Responsibility

Generic Svelte 5 viewmodels and components for the screens every game has (welcome, waiting room, settings, controls, podium).

## Never put here

- Game vocabulary or phase-specific screens (they live in the game).
- Connection logic (`game-client`).
- Direct `window`/`document` reads (moving: #109).
- Per-game viewmodels that could be generic (moving: #62).

## May import

- Runtime: `@partygame/game-client`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: viewmodels, `AppRouter`/`createAppRouter`, `rankRows`, `podiumSteps`.
- `./components`: StatusPanel, Timer, PlayerSticker, Podium, QrCode, ActionBar, ...

## Tests

`tests/` (jsdom, Testing Library); build state through `StubRoom` from `@partygame/game-client/testing`.

## Before you add a file

Would two different games use it unchanged? If not -> the game. Does it talk to the server? -> `game-client`.
