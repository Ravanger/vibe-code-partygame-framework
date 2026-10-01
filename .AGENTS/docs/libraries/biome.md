# Biome Documentation

> **Version:** 2.5.15 (root devDependency). 2.5 deprecates `linter.rules.recommended`; `biome migrate --write` turned it into `"preset": "recommended"`.

## Overview
Single linter and formatter (no ESLint or Prettier). Config is the root `biome.json`:

```json
linter: { preset: "recommended",
  correctness: { noUnusedVariables: "error", noUnusedImports: "error" },
  style: { useConst: "error", useTemplate: "error" } }
formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 100 }
vcs: { enabled: true, clientKind: "git", useIgnoreFile: true }
```
Not configured: `organizeImports`/`assist` (Biome 2 moved it under `assist.actions.source.organizeImports`), quote style, semicolons (defaults apply), overrides.

## Commands
| Command | Description |
|---|---|
| `bun run lint` | `biome check .` (formatter + linter, read-only). Also the first step of `bun run verify`. |
| `bun run format` | `biome format --write .` |
| `biome check --write .` | Apply safe fixes. |

## Biome 2 changes that bit us
- `organizeImports` top-level key was removed; `noConsoleLog` no longer exists under `suspicious` (the config would fail to parse). The repo logs through `console.info` and a local `logger` object in `GameRoom.ts` (Pino is not installed).

## Suppressions in use
Counts across `packages/` and `games/`: `lint/style/noNonNullAssertion` (~100), `lint/suspicious/noExplicitAny` (~85), `noUnusedImports` (6), `noUnusedVariables` (4). Always give a reason after the colon.
- Svelte templates are understood with `html.experimentalFullSupportEnabled: true` (set in `biome.json`); no `.svelte` overrides are needed.
- `GameRoom.onJoin` uses manual casting of `options.name` (`options` is `Record<string, unknown>`).

## Best Practices in This Project
- Run `biome check` before finishing; formatting is enforced at `lineWidth` 100.
- Prefer fixing a type over adding another `noExplicitAny` ignore.
- `turbo.json` has a `lint` task with no script in packages; linting runs from the root only.

## References
- [Biome docs](https://biomejs.dev), [migrate to v2](https://biomejs.dev/guides/migrate-to-v2/)
