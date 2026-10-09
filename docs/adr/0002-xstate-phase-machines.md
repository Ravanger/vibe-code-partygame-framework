# ADR 0002: One XState actor per room drives phases

**Status:** Proposed

## Context

Games are a sequence of phases (Lobby, Play, Results, etc.). Each phase has an optional timer that fires `onTimeout`. Phases can transition to other phases. The runtime must queue transitions so they apply after the current hook returns (no re-entrant sends).

## Decision

The runtime creates one XState actor from the game definition and uses it to own the current phase and its timer. Transitions requested inside a hook are queued and drained after the hook returns. Phase entry, timeout, roster change and action dispatch all run synchronously inside the actor, so queued transitions apply in order.

## Alternatives considered

- **Manual state machine in the runtime:** The runtime tracks phase, timer and queue logic itself. Reason not recorded.
- **Async/await with promises:** Timer fires would return promises. Rejected because hooks are synchronous by design.

## Consequences

Each room has one stateful actor that serializes phase logic. Hooks run inside the actor's action chain, so the context is stable. Transitions cannot execute synchronously inside a hook; they queue and apply once the hook returns. The XState actor is internal; a game author only calls `ctx.transition(name)` and sees `GameContext`.

## Where it lives

- `packages/core/src/runtime/GameRuntime.ts` — actor creation and dispatch (line 10 import, line 66 private field `actor`)
- `packages/core/src/runtime/types.ts` — `GameContext.transition` and `MiddlewareEvent`
- `packages/core/tests/runtime/GameRuntime.test.ts` — tests showing phase transitions, timers and queueing

**Sources:** Code inspection.
