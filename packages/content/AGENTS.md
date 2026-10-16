# @partygame/content

## Responsibility

Game-agnostic content tooling: JSONC parsing and content-directory loading, validated against a caller-supplied Zod schema.

## Never put here

- Game vocabulary (the caller's schemas and domain concepts stay in the game).
- Colyseus, sockets, HTTP, Svelte or DOM code.
- Anything that needs another `@partygame/*` package at runtime; this is a bottom-layer package next to `shared`.

## May import

- Runtime: none
- Dev: `@partygame/config`

## Public entry points

- `.`: `stripJsonComments`, `loadJsoncDir`.

## Tests

`tests/`, plain vitest (node). Content dirs are created in `tmpdir()`.

## Before you add a file

Does one game need it? -> that game. Is it wire format or shared state? -> `shared`. Is it runtime? -> `core`.
