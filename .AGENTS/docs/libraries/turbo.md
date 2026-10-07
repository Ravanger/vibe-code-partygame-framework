# Turbo (Turborepo) Documentation

> **Version:** 2.11.5 (root devDependency, `packageManager: bun@1.4.2`)

## Overview
Orchestrates workspace scripts. Workspaces: `packages/*`, `games/*` (`@partygame/shared`, `core`, `server`, `game-client`, `wit-clash`). Config is `turbo.json` with v2 `tasks` (not `pipeline`).

## Actual `turbo.json`
| Task | Config |
|---|---|
| `build` | `dependsOn: ["^build"]`, `outputs: ["dist/**"]` |
| `test` | `dependsOn: ["^build"]`, `cache: false` |
| `test:ci` | `dependsOn: ["^build"]`, `outputs: ["coverage/**"]` (no package defines this script) |
| `typecheck` | `dependsOn: ["^build"]` (only `games/wit-clash` defines `typecheck`) |
| `lint` | `{}` (no package defines it; root `bun run lint` calls Biome directly) |
| `dev` | `dependsOn: ["^build"]`, `cache: false`, `persistent: true` |

Root scripts: `dev:all` = `turbo run dev`, `build` = `turbo build`, `test` = `turbo test`, `typecheck` = `turbo typecheck`.

## Gotchas
- **`^build` matters**: `core`, `shared`, `game-client` are consumed through `dist/` (`main`/`types`), so tests fail on a clean checkout until dependencies are built. Turbo handles it; plain root `vitest run` does not.
- **Stale `dist`**: if `tsc` produces nothing, Turbo's cache plus `tsconfig.tsbuildinfo` can skip emit. Delete `tsconfig.tsbuildinfo` and rebuild.
- `--parallel` is deprecated; Turbo runs independent tasks in parallel by default. `dev:all` does not pass it.
- Filter a package by its name: `turbo run test --filter=@partygame/server`.
- `.turbo` is gitignored.

## References
- [Turborepo docs](https://turborepo.dev/docs), [configuring tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
