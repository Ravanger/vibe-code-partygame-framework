# Phase 0.5 Implementation Plan: Shared Schema Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the `packages/shared` package with Zod validation schemas for core domain entities.

**Architecture:** A lightweight library exporting Zod schemas and TypeScript types, serving as the single source of truth for runtime validation across the entire monorepo.

**Tech Stack:** TypeScript, Zod, Vitest.

---

### Task 1: Initialize `packages/shared`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**
```json
{
  "name": "@partygame/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/index.ts`**
```typescript
// Initial export
export const VERSION = "0.1.0";
```

---

### Task 2: Implement `RoomCode` Schema & Tests

**Files:**
- Create: `packages/shared/src/schemas/room.ts`
- Create: `packages/shared/tests/schemas/room.test.ts`

- [ ] **Step 1: Write the failing test for `RoomCodeSchema`**
```typescript
import { describe, it, expect } from "vitest"
import { RoomCodeSchema } from "../../src/schemas/room"

describe("RoomCodeSchema", () => {
  it("validates valid 4-character codes", () => {
    expect(RoomCodeSchema.parse("ABCD")).toBe("ABCD")
  })

  it("rejects codes with wrong length", () => {
    expect(() => RoomCodeSchema.parse("ABC")).toThrow()
    expect(() => RoomCodeSchema.parse("ABCDE")).toThrow()
  })

  it("rejects invalid characters", () => {
    expect(() => RoomCodeSchema.parse("ab12")).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
(Running `vitest` will fail as `RoomCodeSchema` is not defined).

- [ ] **Step 3: Implement minimal code in `packages/shared/src/schemas/room.ts`**
```typescript
import { z } from "zod"

export const RoomCodeSchema = z.string().regex(/^[A-Z]{4}$/)
```

- [ ] **Step 4: Export schema in `packages/shared/src/index.ts`**
```typescript
export * from "./schemas/room"
```

- [ ] **Step 5: Run test to verify it passes**

---

### Task 3: Implement `Player` Schema & Tests

**Files:**
- Create: `packages/shared/src/schemas/player.ts`
- Create: `packages/shared/tests/schemas/player.test.ts`

- [ ] **Step 1: Write the failing test for `PlayerNameSchema`**
```typescript
import { describe, it, expect } from "vitest"
import { PlayerNameSchema } from "../../src/schemas/player"

describe("PlayerNameSchema", () => {
  it("validates valid player names", () => {
    expect(PlayerNameSchema.parse("Boris")).toBe("Boris")
  })

  it("rejects empty names", () => {
    expect(() => PlayerNameSchema.parse("")).toThrow()
  })
})
```

- [ ] **Step 2: Implement minimal code in `packages/shared/src/schemas/player.ts`**
```typescript
import { z } from "zod"

export const PlayerNameSchema = z.string().min(1).max(20)
```

- [ ] **Step 3: Update `packages/shared/src/index.ts` and run tests**
(Pass verify).
