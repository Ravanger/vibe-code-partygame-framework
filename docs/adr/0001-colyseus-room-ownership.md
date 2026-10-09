# ADR 0001: Colyseus owns rooms; game rules are Colyseus-free

**Status:** Proposed

## Context

Multi-device games need seat management, reconnection, message routing and broadcast. A game author should declare rules only (phases, actions, scores), not network plumbing.

## Decision

Colyseus (via `GameRoom`) owns the Colyseus-level concerns: creating rooms, joining clients, reconnection grace periods, sending and broadcasting messages, and managing per-client state views. Game rules live in a Colyseus-free runtime behind a `RuntimeHost` interface that the server implements.

## Alternatives considered

- **Embedded game rules in Colyseus room:** The game author writes Colyseus code directly. Rejected because it couples rules to a specific WebSocket transport and server framework.

## Consequences

The `packages/core` runtime has no Colyseus imports. A game definition is testable in Node with a `FakeHost` and replayable from an action log without network code. The Colyseus-specific adapter lives in `GameRoom.ts` (~300 lines) and talks to the runtime through the `RuntimeHost` interface. A game author sees only `defineGame`, phases, actions and the `GameContext`.

## Where it lives

- `packages/core/src/runtime/types.ts` — `RuntimeHost` interface (15 methods: players, send, broadcast, now, rng)
- `packages/server/src/rooms/GameRoom.ts` — the Colyseus adapter implementing `RuntimeHost`
- `packages/core/tests/` — `FakeHost` for testing without Colyseus

**Sources:** Code inspection.
