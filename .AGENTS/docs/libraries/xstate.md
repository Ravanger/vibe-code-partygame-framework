# XState Documentation

> **Version:** v5 (requires TypeScript ≥ 5.0)

## Overview

XState is a state orchestration library based on the actor model and finite state machines. In `vibe-coded`, it drives **game phase logic** — lobby, countdown, round, scoring, game-over — where explicit states and guarded transitions prevent the "impossible states" that plague ad-hoc flag soup. Each Colyseus room owns one or more XState actors that process events and emit state snapshots, keeping server game logic declarative and testable outside of the networking layer.

## Key Concepts

- **Machine:** A configuration object that describes all states, transitions, guards, and actions. Created via `setup(...).createMachine(...)`.
- **Actor:** A running instance of machine logic (or a promise/callback/observable). Created with `createActor(machine)`. Actors have `.start()`, `.send()`, `.subscribe()`, and `.stop()`.
- **`setup()`:** The v5 preferred entry point. Declare `types`, `actions`, `guards`, `actors`, and `delays` upfront for full type safety before calling `.createMachine(config)`.
- **Context:** Arbitrary data attached to a machine instance, updated via `assign(...)`.
- **Events:** Typed messages sent to an actor via `actor.send({ type: "EVENT_NAME", ...payload })`.
- **Guards:** Boolean functions controlling whether a transition is allowed. Declared in `setup({ guards: { ... } })`.
- **Actions:** Side-effect functions (including `assign`) that run on transitions. Named actions make machines testable by replacing implementations via `.provide()`.
- **Actor System:** Calling `createActor(machine)` implicitly creates a system. Child actors registered with a `systemId` can be looked up anywhere in the tree via the receptionist pattern.
- **`fromPromise` / `fromCallback`:** Create non-machine actor logic from async functions or callback patterns, useful for database calls, timers, and external I/O.

## Common Functions/Methods

| Function | Description |
|---|---|
| `setup({ types, actions, guards, actors })` | Declare the machine's type contract and named implementations before creating the machine. |
| `.createMachine(config)` | Returns a machine definition chained from `setup()`. |
| `createActor(machine, { input? })` | Instantiate a machine as a running actor. Pass `input` for initial context injection. |
| `actor.start()` | Start the actor and enter its initial state. |
| `actor.send({ type })` | Send a typed event to the actor's mailbox. |
| `actor.subscribe(snapshot => ...)` | Observe state changes reactively. |
| `actor.getSnapshot()` | Read the current snapshot synchronously. |
| `actor.stop()` | Terminate the actor and clean up. |
| `assign({ ... })` | Action creator that updates context. Accepts an object or updater function. |
| `fromPromise(async ({ input }) => ...)` | Create actor logic from an async function; use `input` to pass data at invocation. |
| `machine.provide({ actions, guards, actors })` | Return a new machine with overridden implementations — useful for testing or per-room variants. |

## Best Practices in This Project

- **Always use `setup()` over bare `createMachine()`.** It enforces typed context, events, and named actions from the start, preventing the type-drift that hits large machines.
- **Model game phases as top-level states.** `lobby | countdown | playing | scoring | gameOver` — don't nest too deep. Flat machines are easier to visualise and debug.
- **Keep Colyseus and XState decoupled.** The machine should not import Colyseus types. The room calls `actor.send(...)` and reads `actor.getSnapshot()` to update `this.state`. This makes machine logic unit-testable with Vitest in isolation.
- **Name all actions and guards.** Anonymous inline functions cannot be mocked or overridden via `.provide()` in tests.
- **Use `fromPromise` for async game logic** (DB lookups, shuffle, round timers with cancellation). Don't `await` directly inside machine config.
- **Store the actor on the Room instance.** Instantiate in `onCreate`, send events in `onMessage`/`onJoin`/`onLeave`, and `actor.stop()` in `onDispose`.
- **Avoid spawning actors in actions if you can use `invoke` instead.** `invoke` ties actor lifetime to the state, providing automatic cleanup on state exit.

## References

- [XState v5 Docs](https://stately.ai/docs)
- [Quick Start](https://stately.ai/docs/quick-start)
- [setup() API](https://stately.ai/docs/setup)
- [Actors](https://stately.ai/docs/actors)
