# ADR 0004: Seeded randomness and an action log make sessions replayable

**Status:** Proposed

## Context

Games use randomness (shuffling, picking categories, rolling dice). If the server crashes or a player's connection drops mid-game, replaying the actions with the same random seed produces the same state, enabling recovery and debugging.

## Decision

Each room gets a random seed drawn from the platform CSPRNG at creation time. The seed is stored in the action log header and used to initialize `mulberry32`, a seeded PRNG that produces platform-independent sequences. IDs that land in synced state or action payloads are drawn from the seeded RNG, not `crypto.randomUUID()`. The `actionLogMiddleware` records every action, transition, timer and roster change to an append-only log in `ctx.priv`. Replaying the log re-dispatches every action with the same seed, reproducing the state.

## Alternatives considered

- **No replay:** Let the server recover from snapshots. Rejected because replay catches logic bugs, enables forensics and cost-free recovery.
- **Record full state snapshots:** Log the entire state at each action. Rejected because snapshots are large and replay loses the ability to step through.

## Consequences

The room RNG is seeded and deterministic. `ctx.newId()` returns UUIDs from the seeded RNG, so they are replayable. The action log lives in `ctx.priv` and is JSON-serializable. Games export the log via `getActionLog(priv)` to replay or analyze. The replay helper `replayLog` is in `packages/core/testing`.

## Where it lives

- `packages/core/src/utils.ts` — `mulberry32` (seeded PRNG), `randomSeed`, `newId` (UUID from RNG)
- `packages/core/src/actionLog.ts` — `ActionLog`, `ActionLogHeader`, `getActionLog`, `actionLogMiddleware`
- `packages/core/tests/replay.test.ts` — replay logic and determinism tests
- `packages/core/tests/qa-action-log-replay.test.ts` — end-to-end replay suite
- `packages/server/src/rooms/GameRoom.ts` — seed generated at line 56, recorded in action log via runtime
- `docs/framework/README.md` — Action log and replay section

**Sources:** Code inspection, `packages/core/src/utils.ts` (comments on `mulberry32` and `newId`), `packages/core/src/actionLog.ts` (header fields, middleware behaviour), `docs/framework/README.md` (Action log and replay section, Determinism contract).
