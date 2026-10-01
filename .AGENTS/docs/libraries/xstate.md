# XState Documentation

> **Version:** 5.33.2 (`packages/core` only; the server no longer depends on it)

## Overview
XState drives phase transitions and phase timers inside `GameRuntime` (`packages/core/src/runtime/GameRuntime.ts`). The runtime generates one machine from the game definition; `GameRoom` never touches XState.

## Used in this repo
| API | Where |
|---|---|
| `setup({ types, delays }).createMachine({ id: "game", initial: "Lobby", on: { GO }, states })` | `GameRuntime.buildMachine`. One state per phase plus `Lobby`; the root `GO { phase }` event targets `.<phase>` with `reenter: true`. |
| `after` with a dynamic delay | Phase timers; the delay comes from the phase's `duration`, firing runs `onTimeout`. |
| `createActor(machine, { clock })`, `.start()`, `.send({ type: "GO", phase })`, `.stop()` | The custom `clock` forwards to `RuntimeHost.setTimeout`, so timers live on the room clock and die with it. |

Not used: `assign`, `fromPromise`, `invoke`, `.getSnapshot()` (the runtime tracks the current phase itself). 5.33 needed no code change.

## Best Practices in This Project
- The machine in `core` must not import Colyseus; the host (`RuntimeHost`) adapts between the two. This keeps logic unit-testable with `FakeHost`.
- Action handlers live in the game definition (`phases[phase].actions[NAME].handler`). Action names are `SCREAMING_SNAKE_CASE`.
- A handler changes phase with `ctx.transition(name)`; transitions are queued and applied after the hook returns, never re-entrantly inside an XState action.
- The server owns the clock: `state.phaseEndsAt` is written on phase entry, the XState delay fires `onTimeout`.

## References
- [XState v5 docs](https://stately.ai/docs)
