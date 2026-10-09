# @partygame/terminal

## Responsibility

Terminal clients for any game: `TerminalPlayer`, `PlaySession`, arg parsers and `runBotsCommand`, driven by a game-supplied `TerminalStrategy`.

## Never put here

- Game-specific prompts or narration (they live in the game).
- Bot logic; the dependency on bots internals is going away (moving: #102).
- Port probing owned elsewhere (moving: #99).

## May import

- Runtime: `@partygame/bots`, `@partygame/server`, `@partygame/shared`
- Dev: `@partygame/config`, `@partygame/core`

## Public entry points

- `.`: `TerminalPlayer`, `PlaySession`, `ReadlinePrompter`, `parsePlayArgs`, `parseBotsArgs`, `runBotsCommand`.
- `./testing`: terminal test helpers.

## Tests

`tests/`; real server via `bootTestServer`, scripted prompter for input.

## Before you add a file

Is it text-terminal I/O? Bot behaviour -> `bots`; launching a stack -> `launcher`.
