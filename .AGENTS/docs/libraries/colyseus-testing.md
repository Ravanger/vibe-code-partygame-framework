# @colyseus/testing Documentation

> **Version:** v0.17.11
> **Package:** `@colyseus/testing@^0.17.11`

## Overview

`@colyseus/testing` is the official testing utility package for Colyseus, providing tools to test room behaviors, message handling, and client-server interactions in the `vibe-coded` party game framework. It enables unit and integration testing of Colyseus rooms without requiring actual WebSocket connections, making tests fast, deterministic, and CI-friendly.

In this project, `@colyseus/testing` is used to test server-side game room logic in `packages/server` and game-specific test suites in `games/wit-clash`.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **`TestRoom`** | A test-friendly wrapper around Colyseus `Room` that simulates client connections without actual WebSocket overhead. |
| **Client Simulation** | Create simulated clients that can join rooms, send messages, and trigger room handlers. |
| **Message Testing** | Assert that specific messages were sent to clients or broadcast to the room. |
| **State Inspection** | Directly access and assert on room state without serialization overhead. |
| **Async/Await Support** | Full async/await support for testing asynchronous room operations. |

## Common Functions/Methods

| Function | Description |
|----------|-------------|
| `createTestRoom(roomClass, options?)` | Creates a test room instance without network overhead. |
| `room.connect(clientOptions?)` | Simulates a client connecting to the room. Returns a simulated client. |
| `client.send(type, message)` | Sends a message from a simulated client to the room. |
| `room.waitForMessage(client, type, timeout?)` | Waits for a specific message type to be received by a client. |
| `room.waitForNextTick()` | Waits for the next simulation tick to complete. |
| `room.simulateTick(deltaTime)` | Manually advances the room simulation by a time delta. |
| `room.clients` | Access the array of connected simulated clients. |
| `room.state` | Direct access to the room's synchronized state. |

## Installation

```bash
# Using Bun (recommended)
bun add -D @colyseus/testing

# Using npm
npm install -D @colyseus/testing

# Using pnpm
pnpm add -D @colyseus/testing

# Using Yarn
yarn add -D @colyseus/testing
```

## Basic Usage

### Testing a Room

```typescript
import { createTestRoom } from "@colyseus/testing";
import { MyRoom } from "./rooms/MyRoom";

const room = createTestRoom(MyRoom);

// Simulate clients joining
const client1 = room.connect();
const client2 = room.connect();

// Advance simulation
room.waitForNextTick();

// Send a message from a client
client1.send("submit", { answer: "test" });

// Wait for the room to process and broadcast
const message = await room.waitForMessage(client2, "submit_result");

// Assert on message content
assert.equal(message.answer, "test");

// Clean up
room.disconnectAll();
```

### Testing State Changes

```typescript
import { createTestRoom } from "@colyseus/testing";
import { GameState } from "./schema/GameState";

const room = createTestRoom(MyRoom);
const client = room.connect();

// Initial state
assert.equal(room.state.players.size, 1);

// Client sends an action
client.send("join_team", { team: "red" });

// Wait for state update
room.waitForNextTick();

// Assert state changed
assert.equal(room.state.players.get(client.sessionId)?.team, "red");
```

## Best Practices in This Project

- **Use `@colyseus/testing` for server-side room tests.** All room logic in `packages/server` and game-specific room extensions should use test utilities from this package.
- **Pair with Vitest for full test coverage.** The project uses Vitest as the test runner; `@colyseus/testing` integrates seamlessly.
- **Test both happy paths and edge cases.** Simulate network errors, invalid messages, and automatic reconnection scenarios.
- **Keep tests deterministic.** Avoid random values in tests; use predictable inputs to ensure consistent outcomes.
- **Clean up resources.** Always disconnect clients and clean up rooms after tests to prevent memory leaks.

## Project Integration

### Testing Setup Example

**`packages/server/tests/room.test.ts`:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRoom } from "@colyseus/testing";
import { GameRoom } from "../src/rooms/GameRoom";

describe("GameRoom", () => {
  let room: ReturnType<typeof createTestRoom>;

  beforeEach(() => {
    room = createTestRoom(GameRoom);
  });

  afterEach(() => {
    room.disconnectAll();
  });

  it("should add player on join", () => {
    const client = room.connect();
    room.waitForNextTick();
    expect(room.state.players.size).toBe(1);
  });
});
```

## References

- [Official Docs](https://docs.colyseus.io)
- [API Reference](https://docs.colyseus.io/api/testing)
- [GitHub Repository](https://github.com/colyseus/colyseus)
- [LLM Index](https://docs.colyseus.io/llms.txt)
