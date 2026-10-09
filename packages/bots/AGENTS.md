# @partygame/bots

## Responsibility

Bot players for any game: `BotPlayer`, `joinBots`, `BotTable`, `DemoTable`, driven by a game-supplied `BotStrategy`.

## Never put here

- Game-specific strategies (they live in the game).
- Generic client helpers such as `claimName` and `apiBaseOf` (moving: #102, #130).
- Terminal I/O or rendering.

## May import

- Runtime: `@partygame/shared`
- Dev: `@partygame/config`, `@partygame/core`, `@partygame/server`

## Public entry points

- `.`: `BotPlayer`, `joinBots`, `BotTable`, `DemoTable`, `BotStrategy`, `BotKit`.

## Tests

`tests/`; boot a real server with `bootTestServer` from `@partygame/server/testing`.

## Before you add a file

Does it decide or pace a bot move? A generic client helper -> `client-utils` (#130); terminal-only -> `terminal`.
