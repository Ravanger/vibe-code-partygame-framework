# Core DSL Builders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `createAction` and `createPhase` builder helpers for the @partygame/core DSL.

**Architecture:** Pure TypeScript functional builders to construct parts of `GameDefinition`.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Setup test scaffolding

**Files:**
- Create: `packages/core/tests/builders.test.ts`

- [ ] **Step 1: Write initial test file**

```typescript
import { describe, it, expect } from 'vitest';
import { createAction, createPhase } from '../src/index.js';

describe('DSL builders', () => {
  it('should be defined', () => {
    expect(createAction).toBeDefined();
    expect(createPhase).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test (Expect fail)**

Run: `npx vitest packages/core/tests/builders.test.ts`
Expected: FAIL ("createAction is not defined")

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/builders.test.ts
git commit -m "test: add builders test scaffold"
```

### Task 2: Implement builders

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Export and implement builders**

```typescript
import { GameDefinition, ActionDefinition, PhaseDefinition } from "./types.js";
export { buildXStateMachine } from "./machine.js";

export function defineGame<TState>(config: GameDefinition<TState>): GameDefinition<TState> {
  return config;
}

export function createAction<TState, TPayload>(config: ActionDefinition<TState, TPayload>): ActionDefinition<TState, TPayload> {
  return config;
}

export function createPhase<TState>(config: PhaseDefinition<TState>): PhaseDefinition<TState> {
  return config;
}
```

- [ ] **Step 2: Run test (Expect pass)**

Run: `npx vitest packages/core/tests/builders.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts packages/core/tests/builders.test.ts
git commit -m "feat: implement createAction and createPhase builders"
```
