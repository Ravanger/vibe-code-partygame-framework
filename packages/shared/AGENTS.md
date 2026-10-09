# @partygame/shared

## Responsibility

The wire protocol and browser-safe state classes every other package agrees on.

## Never put here

- Game vocabulary, Colyseus server code, XState, Svelte or DOM code.
- CLI argument parsing, fetch and URL helpers (moving: #101, to `client-utils` #130, removal #133).
- Anything that needs another `@partygame/*` package; shared is the bottom of the graph.

## May import

- Runtime: none
- Dev: `@partygame/config`

## Public entry points

- `.`: protocol (message names, `ErrorCode`, `ActionResult`, zod schemas), helpers.
- `./schema`: `BaseGameState`, `PlayerSchema`.

## Tests

`tests/`, plain vitest (node). No host helper needed.

## Before you add a file

Is it wire format or state both client and server must share? If not: client helper -> `client-utils` (#130), runtime -> `core`, server -> `server`.
