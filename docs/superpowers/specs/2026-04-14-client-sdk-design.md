# Design Spec: Svelte 5 Client SDK

## 1. Overview
The Client SDK provides a high-level, Svelte 5-native API for interacting with the `vibe-coded` server, abstracting Colyseus complexity behind reactive proxies.

## 2. Architecture
- **`GameClient` (SDK Entrypoint):** Manages connection, authentication (via room joining), and action dispatching.
- **`ReactiveState` (Proxy Layer):** Uses Svelte 5 Runes to mirror the server's `GameStateSchema`.
- **Visibility Awareness:** Because the server sends filtered state, the SDK treats received state as the absolute truth for the current client's role.

## 3. Data Flow
1. **Action:** Component calls `game.send('action_name', payload)`.
2. **Transport:** `colyseus.js` sends message to `GameRoom`.
3. **Response:** Server broadcasts schema change (if state changes).
4. **Reactivity:** SDK updates local runes, Svelte components re-render automatically.

## 4. API (Proposed DX)
```typescript
// Component usage
const game = createGameClient({ roomCode: 'ABCD' });

// Native Svelte 5 Reactivity
$effect(() => {
  console.log("Current Phase:", game.state.phase);
});

// Action Dispatching
game.send('vote', { target: 'player1' });
```

## 5. Error Handling
- SDK will provide a `connectionStatus` state rune (e.g., `'connecting' | 'connected' | 'error'`).
- Actions will support optional promise-based feedback for UI loading states.

## 6. Testing Strategy
- Mock Colyseus Room/Client to verify SDK state updates on message reception.
- Integration tests simulating server-push state changes.
