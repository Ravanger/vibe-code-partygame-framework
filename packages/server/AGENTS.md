# @partygame/server

## Responsibility

The generic Colyseus host that runs any `defineGame` definition: rooms, seats, reconnection, views, room codes and the API.

## Never put here

- Game rules or game vocabulary.
- Content loading (it lives in `@partygame/content`).
- Port probing (it lives in `./probe`).
- Raw Zod messages or ad-hoc close codes sent to clients (use `CLOSE_CODES` and `CLIENT_MESSAGES`).

## May import

- Runtime: `@partygame/client-utils`, `@partygame/core`, `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: `createGameServer`, `GameRoom`, `createApiHandler`, `RoomCodeService`.
- `./bun`: `startServer`.
- `./node`: `serveApi`, `startNodeServer`.
- `./probe`: `ServerProbe`, `freePort`, `closeHttpServer`.
- `./testing`: `bootTestServer`, `seatPlayers`, `joinPlayer`, `stateOf`.

## Tests

`tests/`; room tests boot a real server with `bootTestServer`. Never mock `colyseus`.

## Before you add a file

Is it Colyseus, seat or HTTP-host code? Pure rules -> `core`; client helper -> `game-client`; dev utility -> `launcher`.
