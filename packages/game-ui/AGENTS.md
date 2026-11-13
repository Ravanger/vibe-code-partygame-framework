# @partygame/game-ui

## Responsibility

Generic Svelte 5 viewmodels and components for the screens every game has (welcome, waiting room, settings, controls, podium).

## Never put here

- Game vocabulary or phase-specific screens (they live in the game).
- Connection logic (`game-client`).
- Direct `window`/`document` reads (inject them).
- Per-game viewmodels that could be generic.

## May import

- Runtime: `@partygame/client-utils`, `@partygame/game-client`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: viewmodels, `AppRouter`/`createAppRouter`, `rankRows`, `podiumSteps`.
- `./components`: StatusPanel, Timer, PlayerSticker, Podium, QrCode, ActionBar, ...
- `./testing`: Node-only CSS audits for game test suites (`cssFiles`, `rules`, `stripComments`, `auditContrast`, `auditReducedMotion`); like `game-client`'s, it lives at the package root, not in `src/`.
- `./base.css`: the base look every framework component needs (page baseline, cards, tape, chips, stickers, buttons, notices, hand font class, reduced-motion guards), all on the contract tokens; games import it after `theme-contract.css`.
- `./theme-contract.css`: baseline values for every contract variable, the `main.tv` base sizes for TV displays, plus `.sr-only`; games import it first in `app.css` and override.

## Tests

`tests/` (jsdom, Testing Library); build state through `StubRoom` from `@partygame/game-client/testing`.

## Before you add a file

Would two different games use it unchanged? If not -> the game. Does it talk to the server? -> `game-client`.
