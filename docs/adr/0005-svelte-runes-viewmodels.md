# ADR 0005: Svelte 5 runes viewmodels hold UI logic; screens stay markup

**Status:** Proposed

## Context

Game UI has two layers: state management and sync (join, watch, send actions) and per-screen logic (form validation, modal visibility). Svelte components should be markup-focused; business logic belongs elsewhere.

## Decision

Viewmodels are `.svelte.ts` classes with `$state` runes that hold reactive UI state (form drafts, modal visibility, error messages). Screens are `.svelte` components that read the viewmodel and call its methods. Viewmodels are typed on `GameConnectionManager<TState>` and initialized by components. Games can subclass viewmodels to customize behaviour (e.g., an `isGameOver` predicate for `GameControlsViewModel`).

## Alternatives considered

- **Svelte stores:** Global stores for every piece of UI state. Rejected because viewmodels are scoped to a screen and can hold constructor context (manager, options schema).
- **Component state only:** All logic in `.svelte` components. Rejected because it couples logic to markup and makes testing component logic hard without mounting.

## Consequences

Each screen has a typed viewmodel that can be tested in isolation (jsdom, no Svelte mount). Tests instantiate the viewmodel with a test manager and verify state changes. Components are thin and markup-focused. Generic viewmodels ship in `packages/game-ui`; games import and optionally subclass them. New screens add a viewmodel + component in the game, not in the framework.

## Where it lives

- `packages/game-ui/src/*.svelte.ts` — `WelcomeViewModel`, `WaitingRoomViewModel`, `LobbySettingsViewModel`, `GameControlsViewModel`, `NameField`, `AppRouter`
- `packages/game-ui/tests/` — viewmodel tests with `connectedClient` from `@partygame/game-client/testing`
- `games/wit-clash/ui/screens/*.svelte` — components using viewmodels
- `packages/config/src/svelte.ts` — Svelte compiler config with `runes: true`
- `docs/framework/README.md` — Game UI viewmodels section

**Sources:** Code inspection, `packages/game-ui/src/WelcomeViewModel.svelte.ts` (runes pattern), `packages/config/src/svelte.ts` (runes config).
