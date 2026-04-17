# TypeScript Documentation

> **Version:** v6.0.3
> **Package:** `typescript@^6.0.3`

## Overview

TypeScript is the strongly-typed superset of JavaScript that powers the entire `vibe-coded` party game framework. All packages (`shared`, `core`, `server`, `client`) and games (`wit-clash`) use TypeScript for type safety, code maintainability, and developer experience. TypeScript 6.0 introduces new features while maintaining compatibility with the project's ES modules-first approach.

The project uses TypeScript in two modes:
- **Library Compilation** (`packages/*`) - Produces `.d.ts` type declarations and compiled JavaScript
- **Svelte Processing** (`games/*`) - TypeScript files processed by Svelte compiler and Vite

## Key Concepts

### TypeScript 6.0 Features

| Feature | Description |
|---------|-------------|
| **Named and Anonymous Tuple Elements** | Mix named and positional elements in tuples |
| **Key Remapping in Mapped Types** | More flexible mapped type key transformations |
| **JSDoc `@overload`** | Specify multiple function overloads in JSDoc |
| **Initialized Indexed Access Types** | Type-checked array index access |
| **Performance Improvements** | Faster compilation and type checking |

### Project Configuration

| Concept | Description |
|---------|-------------|
| **ES Modules** | All packages use `"type": "module"` and ESM imports |
| **Strict Mode** | All strict type checking options enabled |
| **Path Aliases** | Configured for clean internal package imports |
| **Composite Builds** | Incremental builds with project references |

## Installation

### Root Package

```bash
# Using Bun (recommended)
bun add -D typescript

# Using npm
npm install -D typescript
```

### Workspace Packages

Each package has TypeScript as a dev dependency:

```bash
# For packages/shared, packages/core, packages/server
bun add -D typescript

# For games/wit-clash
bun add -D typescript
```

## Configuration

### Root `tsconfig.json`

**`tsconfig.json` (monorepo root):**
```json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "lib": ["ESNext"],
    "types": ["vitest/globals"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@partygame/*": ["packages/*/src/index.ts"],
      "@partygames/*": ["games/*/src/index.ts"]
    }
  },
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/core" },
    { "path": "packages/server" },
    { "path": "packages/client" },
    { "path": "games/wit-clash" }
  ]
}
```

### Package Configuration

**`packages/shared/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmitOnError": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

**`packages/core/tsconfig.json`:** (similar to shared)

**`packages/server/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["@colyseus/core", "@colyseus/schema", "node", "bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

**`packages/client/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@vite/client", "svelte", "@colyseus/sdk"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

**`games/wit-clash/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@testing-library/jest-dom", "@testing-library/user-event"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

## Common TypeScript Patterns in This Project

### Type-Only Imports

```typescript
// For types only - no runtime code
type { GameState } from "@partygame/shared";

// For both types and runtime
export { GameState, GameStateSchema } from "@partygame/shared";
```

### Zod Schema Types

```typescript
import { z } from "zod";

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(20),
  score: z.number().int().nonnegative(),
});

// Inferred type
export type Player = z.infer<typeof PlayerSchema>;
```

### Generic Types

```typescript
// Game events with discriminated union
export type GameEvent = 
  | { type: "submitAnswer"; payload: { answer: string } }
  | { type: "vote"; payload: { playerId: string; choice: number } }
  | { type: "nextRound" };

// Room options
export interface RoomOptions {
  maxPlayers: number;
  timePerRound: number;
  allowSpectators: boolean;
}
```

### Type Guards

```typescript
function isGameState(obj: unknown): obj is GameState {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "phase" in obj &&
    "players" in obj
  );
}
```

## TypeScript with Svelte 5

Svelte 5 components use `.svelte` extension and are processed by the Svelte compiler. TypeScript types in `.svelte` files:

```svelte
<script lang="ts">
  // TypeScript in Svelte components
  let count = $state<number>(0);
  
  interface Props {
    title: string;
    active?: boolean;
  }
  
  let { title, active = false }: Props = $props();
  
  function increment() {
    count++;
  }
</script>

<button onclick={increment} class={active ? "active" : ""}>
  {title}: {count}
</button>
```

## Best Practices in This Project

- **Enable strict mode everywhere.** All `tsconfig.json` files have `"strict": true`.
- **Type all function parameters and returns.** Explicit types improve maintainability.
- **Use `z.infer` for Zod schemas.** Always pair schemas with their inferred types.
- **Prefer interfaces for public APIs.** Use `interface` for exported types, `type` for internal/union types.
- **Leverage path aliases.** Use `@partygame/*` imports for clean cross-package references.
- **Mark test files appropriately.** Exclude `*.test.ts` and `*.spec.ts` from production builds.

### Path Aliases

The monorepo configures path aliases for clean imports:

```typescript
// Instead of this:
import { Player } from "../../../packages/shared/src/types/player";

// Use this:
import { Player } from "@partygame/shared";
```

## Scripts

### Type Checking

```bash
# Type-check all packages
bun run typecheck

# Or via turbo
turbo run typecheck
```

**`package.json` (each package):**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

### Build

```bash
# Build all packages
bun run build

# Build specific package
cd packages/server && bun run build
```

## TypeScript 6.0 Migration Notes

TypeScript 6.0 is fully compatible with the project. Key changes:

- **Stricter `any` checks** - More errors when mixing `any` with other types
- **New JSDoc features** - `@overload` support for function declarations
- **Performance** - Faster compilation, especially in monorepos
- **No breaking changes** - All existing code continues to work

## Troubleshooting

### Type Errors After Dependency Update

**Symptom:** Type errors appear after updating a dependency.
**Solution:** Check if the package has updated type definitions. Run `bun add PACKAGE@version` to ensure types are installed.

### Path Aliases Not Working

**Symptom:** Imports with `@partygame/*` fail to resolve.
**Solution:** Ensure `baseUrl` and `paths` are correctly configured in `tsconfig.json`. Rebuild if needed.

### Module Resolution Errors

**Symptom:** "Cannot find module" errors with ESM imports.
**Solution:** Verify `"type": "module"` in `package.json` and `"moduleResolution": "bundler"` in `tsconfig.json` for Bun/Vite projects.

### Slow Compilation

**Symptom:** TypeScript compilation is slow in large packages.
**Solution:** Enable `"incremental": true` and ensure `"composite": true` is set for monorepo builds. Delete `tsconfig.tsbuildinfo` for a fresh compile.

## References

- [Official TypeScript Docs](https://www.typescriptlang.org/docs/)
- [TypeScript 6.0 Release Notes](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Configuration Reference](https://www.typescriptlang.org/tsconfig)
- [ES Modules in TypeScript](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
