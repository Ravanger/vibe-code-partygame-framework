# Svelte 5 Client SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reactive Svelte 5 Client SDK that interfaces with the Colyseus room.

**Architecture:** A `GameClient` class will manage the connection and expose state as Svelte 5 runes.

**Tech Stack:** Bun, Colyseus 0.16, Svelte 5 (Runes), Zod.

---

### Task 1: Initialize Client SDK Structure

**Files:**
- Modify: `packages/client/package.json`
- Create: `packages/client/src/index.ts`
- Create: `packages/client/src/types.ts`

- [ ] **Step 1: Add dependencies to package.json**
Add `colyseus.js` to dependencies.

- [ ] **Step 2: Create basic exports in `src/index.ts`**
Create `export { GameClient } from "./GameClient.js"` (placeholder for now).

- [ ] **Step 3: Define basic types in `src/types.ts`**
```typescript
export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';
```

- [ ] **Step 4: Commit**

### Task 2: Implement Reactive State and GameClient

**Files:**
- Create: `packages/client/src/GameClient.ts`
- Modify: `packages/client/src/state.svelte.ts`

- [ ] **Step 1: Write test for GameClient in `packages/client/tests/state.test.ts`**
Verify that a mock server push updates the reactive state.

- [ ] **Step 2: Run test to verify it fails**
Expected: Fails because `GameClient` is not implemented.

- [ ] **Step 3: Implement GameClient**
Implement connection logic and reactive state synchronization.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

### Task 3: Expose Client SDK API

**Files:**
- Modify: `packages/client/src/index.ts`

- [ ] **Step 1: Export `createGameClient` factory function**
```typescript
export function createGameClient(options: { roomCode: string }) {
  return new GameClient(options);
}
```

- [ ] **Step 2: Commit**

---
