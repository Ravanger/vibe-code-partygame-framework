# @partygame/server

## Responsibility

The generic Colyseus host that runs any `defineGame` definition: rooms, seats, reconnection, views, room codes and the API.

## Never put here

- Game rules or game vocabulary.
- Content loading (`./content`, moving: #81).
- Port probing and probes in `./node` (moving: #99).
- Raw Zod messages or ad-hoc close codes sent to clients (moving: #141).

## May import

- Runtime: `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: `createGameServer`, `GameRoom`, `createApiHandler`, `RoomCodeService`.
- `./bun`: `startServer`.
- `./node`: `serveApi`, `startNodeServer`, port helpers.
- `./content`: `loadJsoncDir`.
- `./testing`: `bootTestServer`, `seatPlayers`, `joinPlayer`, `stateOf`.

## Tests

`tests/`; room tests boot a real server with `bootTestServer`. Never mock `colyseus`.

## Before you add a file

Is it Colyseus, seat or HTTP-host code? Pure rules -> `core`; client helper -> `game-client`; dev utility -> `launcher`.
