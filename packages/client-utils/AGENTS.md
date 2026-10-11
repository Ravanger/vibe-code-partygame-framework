# @partygame/client-utils

## Responsibility

Browser- and Node-safe client helpers: `waitFor`, `resolveRoomCode`, `joinUrl`, `tvUrl`, `between`. No `node:` imports, no Colyseus.

## Never put here

- Server or runtime code (that is `core` or `server`), game vocabulary, Svelte or DOM code.
- Anything that needs an `@partygame/*` package besides `shared`.

## May import

- Runtime: `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: `waitFor`, `resolveRoomCode`, `joinUrl`, `tvUrl`, `between`, type `Parsed`.

## Tests

`tests/`, plain vitest (node). No host helper needed.

## Before you add a file

Is it a client helper both browser and Node can use? If it needs more than `shared`, it belongs in `game-client` or later.
