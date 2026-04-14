# Role-Based State Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a declarative, DSL-driven state visibility system that filters `GameStateSchema` before syncing to clients based on role-based predicates defined in the `defineGame` configuration.

**Architecture:** 
1. Expand `defineGame` DSL to accept a `visibility` configuration object.
2. Implement a `VisibilityEnforcer` in `@partygame/core` that evaluates these predicates.
3. Implement `RoleBasedStateView` in `@partygame/server` that intercepts `onJoin` / `onSync` to apply these filters per client.

**Tech Stack:** TypeScript, Colyseus 0.16, XState v5.

---

### Task 1: Define DSL for Visibility in `@partygame/core`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Define `VisibilityPredicate` type in `packages/core/src/types.ts`**

```typescript
import { GameStateSchema } from "../../server/src/schema/GameStateSchema"; // Note: Adjust import path if needed based on mono-repo structure
import { PlayerSchema } from "../../server/src/schema/PlayerSchema";

export type VisibilityPredicate = (state: any, viewer: PlayerSchema) => boolean;

export interface GameVisibilityConfig {
  [key: string]: VisibilityPredicate;
}
```

- [ ] **Step 2: Update `GameDefinition` in `packages/core/src/types.ts` to include `visibility`**

```typescript
export interface GameDefinition<TState> {
  // ... existing fields
  visibility?: GameVisibilityConfig;
}
```

- [ ] **Step 3: Update `defineGame` in `packages/core/src/index.ts` to accept the new visibility config.**

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add visibility configuration to DSL"
```

### Task 2: Implement Visibility Enforcer in `@partygame/core`

**Files:**
- Create: `packages/core/src/visibility.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `VisibilityEnforcer` logic**

```typescript
import { GameDefinition } from "./types";
import { PlayerSchema } from "../../server/src/schema/PlayerSchema";

export function enforceVisibility(state: any, viewer: PlayerSchema, config: GameVisibilityConfig) {
  const filteredState = { ...state };
  for (const [key, predicate] of Object.entries(config)) {
    if (!predicate(state, viewer)) {
      delete filteredState[key];
    }
  }
  return filteredState;
}
```

- [ ] **Step 2: Export `enforceVisibility` from `packages/core/src/index.ts`**

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/visibility.ts packages/core/src/index.ts
git commit -m "feat(core): implement visibility enforcer utility"
```

### Task 3: Implement Role-Based StateView in `@partygame/server`

**Files:**
- Create: `packages/server/src/rooms/RoleBasedStateView.ts`
- Modify: `packages/server/src/rooms/GameRoom.ts`

- [ ] **Step 1: Create `RoleBasedStateView`**

```typescript
import { StateView } from "@colyseus/schema";
import { enforceVisibility } from "@partygame/core";

export class RoleBasedStateView extends StateView {
  constructor(private state: any, private viewer: any, private config: any) {
    super();
    this.add(enforceVisibility(state, viewer, config), 1);
  }
}
```

- [ ] **Step 2: Update `GameRoom` to use `RoleBasedStateView`**

Modify `onJoin` in `GameRoom.ts`:

```typescript
onJoin(client: Client) {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  
  client.view = new RoleBasedStateView(this.state, player, this.gameDefinition.visibility || {});
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/rooms/RoleBasedStateView.ts packages/server/src/rooms/GameRoom.ts
git commit -m "feat(server): implement role-based state view"
```
