# @partygame/core

## Responsibility

The Colyseus-free game runtime: `defineGame`, `GameRuntime`, lobby built-ins, action log and scoring helpers.

## Never put here

- Colyseus, sockets, HTTP, Svelte or DOM code.
- Game vocabulary (phase names, card rules).
- Zod text or exception text in client-facing errors (throw `FrameworkError`; clients see `CLIENT_MESSAGES`).
- New host needs outside the `RuntimeHost` interface.

## May import

- Runtime: `@partygame/content` (types only: `TextFilter`/`FilterLevel` for the text-filter middleware), `@partygame/shared`
- Dev: `@partygame/config`

## Public entry points

- `.`: `defineGame`, `actionFactory`, `GameRuntime`, scoring, roster guards (`seatedCount`, `isBelowMinimum`, `departedIds`), `shuffle`, action log, `textFilterMiddleware`.
- `./kits`: phase kits (`@experimental`): collectResponses (`allResponded`, `entriesFor`, `dropLeavers`), voteAndTally (`tallyVotes`, `allHaveVoted`, `countVoted`, `eligibleVoters`, `leaders`), drawPool (`drawPool`).
- `./testing`: `FakeHost`, `TestTable`, `replayLog`.

## Tests

`tests/`; drive the real `GameRuntime` with `FakeHost`/`TestTable`. Never mock the runtime.

## Before you add a file

Does it run with no network and no Colyseus? If not -> `server`. Does one game need it? -> that game. Runtime internals are being split (#38, #39, #40).
