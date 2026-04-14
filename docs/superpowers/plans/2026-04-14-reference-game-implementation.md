# Reference Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reference game logic using the Orchestrator/Phase Handler pattern.

**Architecture:**
- Orchestrator (XState machine in `GameRoom.ts`)
- Phase Handlers (e.g., `PromptHandler.ts`, `VoteHandler.ts`)
- Action-based communication via Zod-validated schemas.

**Tech Stack:** Bun, XState v5, Zod.

---

### Task 1: Define Game Actions & Schema
**Files:**
- Create: `packages/shared/src/schemas/game-actions.ts`

- [ ] **Step 1: Write Action Schemas**

```typescript
// packages/shared/src/schemas/game-actions.ts
import { z } from 'zod';

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SubmitAnswer'), answer: z.string() }),
  z.object({ type: z.literal('CastVote'), answerId: z.string() }),
  z.object({ type: z.literal('AcknowledgeReveal') }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;
```

- [ ] **Step 2: Commit**

### Task 2: Implement Phase Handler Interface
**Files:**
- Create: `packages/core/src/phases/types.ts`

- [ ] **Step 1: Define PhaseHandler interface**

```typescript
// packages/core/src/phases/types.ts
import type { GameAction } from '@partygame/shared';

export interface PhaseHandler {
  handleAction(player: string, action: GameAction): void;
  computeVisibility(): any;
}
```

- [ ] **Step 2: Commit**

### Task 3: Implement PromptPhase Handler
**Files:**
- Create: `packages/core/src/phases/PromptPhase.ts`

- [ ] **Step 1: Write implementation**

```typescript
// packages/core/src/phases/PromptPhase.ts
import type { PhaseHandler } from './types.js';
import type { GameAction } from '@partygame/shared';

export class PromptPhase implements PhaseHandler {
  handleAction(player: string, action: GameAction) {
    if (action.type !== 'SubmitAnswer') throw new Error('Invalid Action');
    // Logic to store answer...
  }
  computeVisibility() { return { phase: 'Prompting' }; }
}
```

- [ ] **Step 2: Add test for PromptPhase**

```typescript
// packages/core/tests/phases/PromptPhase.test.ts
import { expect, it } from 'vitest';
import { PromptPhase } from '../../src/phases/PromptPhase.js';

it('should throw on invalid action', () => {
  const phase = new PromptPhase();
  expect(() => phase.handleAction('p1', { type: 'CastVote', answerId: '1' })).toThrow();
});
```

- [ ] **Step 3: Commit**

### Task 4: Integrate into GameRoom (XState)
**Files:**
- Modify: `packages/server/src/rooms/GameRoom.ts`

- [ ] **Step 1: Wire XState machine to use Phase Handlers**
- [ ] **Step 2: Verify tests**
- [ ] **Step 3: Commit**
