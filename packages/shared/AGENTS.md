# @partygame/shared

## Responsibility

The wire protocol and browser-safe state classes every other package agrees on.

## Never put here

- Game vocabulary, Colyseus server code, XState, Svelte or DOM code.
- CLI argument parsing, fetch and URL helpers (they live in `@partygame/client-utils`).
- Anything that needs another `@partygame/*` package; shared is the bottom of the graph.

## May import

- Runtime: none
- Dev: `@partygame/config`

## Public entry points

- `.`: protocol (message names, `ErrorCode`, `ActionResult`, zod schemas), limits (`NAME_MAX_LENGTH`).
- `./schema`: `BaseGameState`, `PlayerSchema`, `syncedJsonOf`, `syncedStateFromJson`.

## Tests

`tests/`, plain vitest (node). No host helper needed.

## Before you add a file

Is it wire format or state both client and server must share? If not: client helper -> `client-utils`, runtime -> `core`, server -> `server`.
