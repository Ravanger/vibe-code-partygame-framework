# TypeScript Documentation

> **Version:** 6.0.3 (every package resolves 6.0.3; declared `^6.0.3` in root and each package)

## Overview
Strict TypeScript across the monorepo. Shared options live in `tsconfig.base.json`; packages extend it.

## Configuration facts
| File | Key settings |
|---|---|
| `tsconfig.base.json` | `target ES2022`, `module/moduleResolution NodeNext`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `declaration`, `experimentalDecorators`, `emitDecoratorMetadata`, `lib ES2022 + DOM`, `skipLibCheck`, `esModuleInterop`. |
| `packages/{shared,core,game-client}/tsconfig.json` | `outDir ./dist`, `rootDir ./src`, `include ["src"]`. Built with plain `tsc`; consumers import the built `dist` (`main`/`types` point at `dist/index.*`), so Turbo `^build` must run first. |
| `packages/server/tsconfig.json` | `rootDir ./src`, `outDir ./dist`. |
| `games/wit-clash/tsconfig.json` | `module ESNext`, `moduleResolution bundler`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["vitest/globals", "jsdom", "vite/client", "@testing-library/jest-dom"]`. Script `typecheck` = `tsc --noEmit`. |
| `games/wit-clash/tsconfig.verify.json` | `src` + `index.ts` only (no `ui`, no tests); used by root `verify`. |

## Gotchas
- **NodeNext packages need `.js` extensions in relative imports** (`./rooms/GameRoom.js`) even though files are `.ts`. wit-clash uses `bundler` resolution and does not.
- `experimentalDecorators`, `emitDecoratorMetadata` and `useDefineForClassFields: false` were removed with the move to Schema 5's decorator-free `schema()` ([colyseus-schema.md](colyseus-schema.md)). Do not reintroduce them.
- `exactOptionalPropertyTypes` rejects passing `undefined` to an optional property; omit the key or widen the type.
- `noUncheckedIndexedAccess` makes `array[i]` / `record[key]` possibly `undefined`; the code uses `!` (100 `biome-ignore noNonNullAssertion` comments) or guards.
- Stale build: if `tsc` emits nothing, delete `tsconfig.tsbuildinfo` (Turbo cache vs incremental info). `*.tsbuildinfo` is gitignored.
- `bun` has no TS declarations in the npm package; `packages/server/src/index.ts` uses `// @ts-expect-error` on `import { serve } from "bun"`.
- TypeScript 6.0 required no source changes for this repo.

## Patterns
- `import type` / inline `type` specifiers for type-only imports (required by `verbatimModuleSyntax` in wit-clash).
- Zod is the single source of types: `export type GameAction = z.infer<typeof GameActionSchema>` ([zod.md](zod.md)).

## References
- [TypeScript docs](https://www.typescriptlang.org/docs/), [TS 6.0 notes](https://devblogs.microsoft.com/typescript/)
