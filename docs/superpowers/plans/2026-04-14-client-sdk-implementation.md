# Svelte 5 Reactive Client SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reactive Svelte 5 Client SDK based on the service-provider architecture using Runes.

**Architecture:** 
- `GameRoomState` (runes class) manages reactive data.
- `GameClient` (service) manages lifecycle and syncs server state.
- Context provider/hook for clean component consumption.

**Tech Stack:** Bun, Svelte 5 (Runes), Colyseus.js.

---

### Task 1: Create GameRoomState Rune Class

**Files:**
- Create: `packages/client/src/state.svelte.ts`
- Test: `packages/client/tests/state.test.ts`

- [ ] **Step 1: Define GameRoomState with Runes**

```typescript
// packages/client/src/state.svelte.ts
export class GameRoomState {
  count = $state(0);

  sync(serverState: any) {
    if (serverState.count !== undefined) {
      this.count = serverState.count;
    }
  }
}
```

- [ ] **Step 2: Update tests to verify reactivity/sync**

```typescript
// packages/client/tests/state.test.ts
import { expect, it } from 'vitest';
import { GameRoomState } from '../src/state.svelte.js';

it('should sync state from server', () => {
  const state = new GameRoomState();
  state.sync({ count: 10 });
  expect(state.count).toBe(10);
});
```

- [ ] **Step 3: Verify pass**
- [ ] **Step 4: Commit**

### Task 2: Implement Context Injection

**Files:**
- Create: `packages/client/src/context.ts`

- [ ] **Step 1: Write Context Helpers**

```typescript
// packages/client/src/context.ts
import { setContext, getContext } from 'svelte';
import type { GameClient } from './GameClient.js';

const CLIENT_KEY = Symbol('GAME_CLIENT');

export function provideGameClient(client: GameClient) {
  setContext(CLIENT_KEY, client);
}

export function useGameClient(): GameClient {
  return getContext(CLIENT_KEY);
}
```

- [ ] **Step 2: Commit**

### Task 3: Integrate Sync into GameClient

**Files:**
- Modify: `packages/client/src/GameClient.ts`

- [ ] **Step 1: Update GameClient to hold state and listen for changes**

```typescript
// packages/client/src/GameClient.ts
import { GameRoomState } from './state.svelte.js';
import type { ConnectionStatus } from './types.js';

export class GameClient {
  public connectionStatus: ConnectionStatus = 'connecting';
  public state = new GameRoomState();
  private roomCode: string;

  constructor(options: { roomCode: string }) {
    this.roomCode = options.roomCode;
  }

  // Hook for Colyseus room
  onStateChange(serverState: any) {
    this.state.sync(serverState);
  }
}
```

- [ ] **Step 2: Verify existing tests pass**
- [ ] **Step 3: Commit**
