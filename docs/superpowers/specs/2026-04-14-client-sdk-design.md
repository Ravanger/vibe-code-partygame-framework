# Svelte 5 Reactive Client SDK Design

## Overview
A reactive, service-oriented architecture for the `vibe-coded` client, leveraging Svelte 5 Runes and Context API to provide a seamless developer experience.

## Components

### 1. `GameRoomState` (in `state.svelte.ts`)
This class will be a Svelte 5 state class (runes). It will represent the client-side view of the game state.
- **Responsibilities**: Stores reactive state properties, defines methods for state mutations (if applicable).
- **Mapping**: Will feature a `sync(serverState: any)` method to map Colyseus schema types to local Rune-based state.

### 2. Service Provider (`context.ts`)
- `provideGameClient(client: GameClient)`: Uses `setContext` to make the client instance available to the component tree.
- `useGameClient()`: Uses `getContext` to retrieve the client instance, ensuring type safety.

### 3. `GameClient`
- **Responsibilities**: Manages the Colyseus connection lifecycle.
- **Integration**: Holds the `GameRoomState` instance and updates it reactively on Colyseus `onStateChange` events.

## Data Flow
1. **Connection**: `GameClient` establishes a Colyseus connection.
2. **Subscription**: `GameClient` subscribes to `onStateChange`.
3. **Synchronization**: On every state change, `GameClient` calls `state.sync(serverState)`.
4. **Reactivity**: Svelte 5 runes update the UI automatically.

## Error Handling
- The `connectionStatus` rune in `GameClient` will track `connecting`, `connected`, `error`, and `disconnected` states.
- UI components can reactively check this status to show loaders or error messages.

## Testing Strategy
- **Unit**: Test `GameRoomState` sync logic with mock server states.
- **Integration**: Mock `GameClient` to verify context injection works in components.
- **E2E**: Verify connectivity and state updates in `tests/`.

---
*Does this design look right to you?*
