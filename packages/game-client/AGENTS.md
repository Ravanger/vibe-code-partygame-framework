# @partygame/game-client

## Responsibility

The Svelte 5 SDK a game client uses to connect, join, send actions and read state.

## Never put here

- Visual components or viewmodels for screens (`game-ui`).
- Game vocabulary or rule recomputation.
- Server code; `core` and `server` are dev-only, for tests.
- Room-code and browser-global handling that belongs behind injection (moving: #109).

## May import

- Runtime: `@partygame/client-utils`, `@partygame/shared`
- Dev: `@partygame/config`, `@partygame/core`, `@partygame/server`

## Public entry points

- `.`: `GameConnectionManager`, `Countdown`, `resolveEndpoints`, `readCodeParam`.
- `./test-setup`: vitest setup for jsdom.
- `./testing`: `StubRoom`, `connectedClient`, `addSeat`, `fakeFetch`.

## Tests

`tests/` (jsdom); use `StubRoom` or a real state object. The manager is being split (#41, #42).

## Before you add a file

Is it connection or session logic with no markup? If it renders -> `game-ui`; shared with non-browser clients -> `client-utils` (#130).
