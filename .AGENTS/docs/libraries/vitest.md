# Vitest Documentation

> **Version:** 4.1.11 (root and every package resolve the same copy; 5.x deliberately not adopted). Coverage: see [vitest-coverage.md](vitest-coverage.md).

## Overview
Single test runner for all packages. Root `vitest.config.mts` (and a duplicate `vitest.workspace.ts`) list five projects: `packages/shared`, `packages/core`, `packages/server`, `packages/game-client`, `games/wit-clash`, each with its own `vitest.config.ts`. Each package's `test` script is `vitest run`; root `bun run test` goes through Turbo.

## Commands
| Command | Description |
|---|---|
| `vitest run` | Single pass for all projects (always use this non-interactively; bare `vitest` watches and hangs). |
| `vitest run --project @partygame/server` | One project. Only the server config sets `test.name`; others use the directory. |
| `vitest run path/to/file.test.ts` | One file. |
| `vitest run --coverage` | Root script `test:coverage`; thresholds are 100% for lines/functions/branches/statements. |

## Per-project config differences
| Project | Environment | Notable |
|---|---|---|
| `server` | node | `fileParallelism: false`, `deps.interopDefault`. No transform plugin: Schema 5 needs no decorator support. |
| `core`, `shared` | node | Plain. |
| `game-client` | jsdom | `svelte()` plugin, storage stubs in `vitest.setup.ts`. |
| `wit-clash` | jsdom | `svelte-ts-runes` plugin, `globals: true`, setup `../../vitest.setup.ts` (jest-dom, `localStorage`, `@colyseus/tools` mock). |

## Vitest 4 changes that bit us
- `vi.mock()` factories are hoisted: classes or variables referenced inside must be defined inside the factory. Use prototype methods (`Client.prototype.joinOrCreate`) so tests can override them.
- Vite 8 uses oxc for TS. Legacy decorators needed `oxc: false` plus a TypeScript transform plugin; Schema 5 removed the need, and the plugins and `oxc: false` are gone.
- `coverage.all` was removed in v4 (see vitest-coverage.md).

## Patterns used
`vi.fn` (63), `vi.useFakeTimers` / `advanceTimersByTime` (phase timers; always `useRealTimers` after), `vi.stubGlobal`, `vi.mock` (7), `vi.spyOn`. No property-based testing: `fast-check` is not installed despite AGENTS.md.

## Best Practices in This Project
- TDD: failing test first; do not mock the module under test.
- Never leave a suite as `.skip`; the server harness test is included on purpose.
- Prefer polling barriers (`waitUntil`) over fixed sleeps in server tests ([colyseus-testing.md](colyseus-testing.md)).

## References
- [Vitest docs](https://vitest.dev), [v4 migration](https://vitest.dev/guide/migration.html)
