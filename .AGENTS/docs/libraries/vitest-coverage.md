# Vitest Coverage Documentation

> **Package:** `@vitest/coverage-v8` 4.1.11 (matches Vitest 4.1.11 exactly; upgrade the two together). `@vitest/coverage-istanbul` is no longer installed.

## Overview
Only the **v8** provider is configured: root `vitest.config.mts` sets `coverage.provider: "v8"` with `reporter: ["text", "html", "lcov"]`, output `./coverage`, and 100% thresholds for lines, functions, branches and statements. Per-package configs only set `coverage.include` (`src/**/*.ts`, plus `ui/**/*.ts` for wit-clash).

## Commands
| Command | Description |
|---|---|
| `bun run test:coverage` | `vitest run --coverage` over all projects. |
| `bun run verify` | `biome check . && tsc --noEmit -p games/wit-clash/tsconfig.verify.json && vitest run --coverage`. |

## Root exclusions (documented reasons)
- Entry points: `packages/server/src/bun.ts`, `games/wit-clash/server.ts`, `games/wit-clash/ui/main.ts`, `src/types.ts`.
- `**/*.svelte`: Svelte transforms break v8 source maps.
- `GameRoom.ts` and the schemas are covered (100%) by the real-server tests in `packages/server/tests`.

## Notes
- `coverage.all` was removed in Vitest 4; uncovered files are reported through `coverage.include`.
- `@vitest/coverage-v8` must match the Vitest version exactly; upgrade them together. Vitest 5 is deliberately not adopted.

## References
- [Vitest coverage guide](https://vitest.dev/guide/coverage.html), [v4 migration](https://vitest.dev/guide/migration.html)
