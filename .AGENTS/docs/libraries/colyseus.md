# Colyseus Documentation

> **Package:** `colyseus` (server v0.17), `@colyseus/sdk` (client v0.17)
> **Previous:** `colyseus.js` (client v0.16 - deprecated in favor of `@colyseus/sdk`)

## Overview

Colyseus is the real-time multiplayer framework at the core of `vibe-coded`. It manages WebSocket connections, room matchmaking, client sessions, and state synchronisation between the Node.js game server and all connected devices. Each party game is a `Room` subclass — players join rooms, the server mutates a `@colyseus/schema` state object, and Colyseus delta-encodes and broadcasts changes to all clients automatically.

## Version Note

**The project uses Colyseus v0.17.** As of v0.17, the client package changed from `colyseus.js` to `@colyseus/sdk`. The server package remains `colyseus`. This was a breaking change in the seat reservation response format.

### v0.17 Breaking Changes

**Matchmaker Seat Reservation Format:** The response format changed from:
```json
{
  "sessionId": "zzzzzzzzz",
  "room": { "roomId": "xxxxxxxxx", "processId": "yyyyyyyyy", "name": "battle" }
}
```
to:
```json
{
  "name": "battle",
  "roomId": "xxxxxxxxx",
  "processId": "yyyyyyyyy",
  "sessionId": "zzzzzzzzz"
}
```

**Client Package:** Replaced `colyseus.js` with `@colyseus/sdk`

**Room Generic Types:** Changed from `Room<State, Metadata>` to `Room<{ state: S, metadata: M, client: C }>`

**Client Generic Types:** Changed from `Client<UserData, AuthData>` to `Client<{ userData: U, auth: A, messages: M }>`

**onLeave Parameter:** Changed from `consented: boolean` to `code: number`

** gospels:** Use `CloseCode` enum from `colyseus` instead of `Protocol.WS_*`

See full [Migration Guide v0.17](https://docs.colyseus.io/migrating/0.17) for details.

## Key Concepts

- **Room:** A server-side class extending `Room<StateType>`. Encapsulates a game session's lifecycle, player registry, and message handling.
- **Client:** Represents a connected player. Has a `sessionId` (unique per connection), `userData` (server-only custom bag), and `auth` (value returned from `onAuth`).
- **State Synchronisation:** Assign a `@colyseus/schema` instance via `this.state = new MyState()` in the class body (or `this.setState()` in older patterns). Colyseus diffs and pushes delta patches to clients on every simulation interval.
- **Matchmaking:** Clients call `client.joinOrCreate("room_name", options)`. The server uses `gameServer.define("room_name", MyRoom)` to register rooms. Colyseus handles room creation and recycling automatically.
- **`allowReconnection`:** Called inside `onDrop` to hold a seat open for a dropped client. Returns a deferred that resolves on successful reconnect or rejects after a timeout.
- **`onDrop`:** Called when a client disconnects unexpectedly (before the reconnection window). Use here to mark the player inactive.
- **Server Define API:** `defineServer({ rooms, express, routes })` — new Vite-plugin-friendly entry point that co-locates server setup.

## Installation

### Server (Node.js)

```bash
# Core packages
npm install colyseus @colyseus/core

# Transport (choose one)
npm install @colyseus/ws-transport        # WebSocket (default)
# npm install @colyseus/uwebsockets-transport  # uWebSockets.js
# npm install @colyseus/webtransport        # WebTransport
# npm install @colyseus/bun-websockets      # Bun WebSockets

# Optional: Schema, Redis, Testing
npm install @colyseus/schema
npm install @colyseus/redis-driver @colyseus/redis-presence
npm install @colyseus/testing
```

### Client

```bash
# TypeScript/JavaScript
npm install @colyseus/sdk

# Previous (deprecated for v0.17+)
# npm install colyseus.js  # v0.16 only
```

## Server Setup

### Basic Server

```typescript
// app.config.ts (recommended for v0.17+)
import { defineServer, defineRoom } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyRoom } from "./rooms/MyRoom";

const server = defineServer({
    transport: new WebSocketTransport({
        pingInterval: 10000
    }),
    rooms: {
        my_room: defineRoom(MyRoom),
        battle: defineRoom(MyRoom, { map: "default" })
    },
    express: (app) => {
        app.get("/health", (req, res) => res.send("OK"));
    }
});

server.listen(2567);
```

### Legacy Server

```typescript
// src/index.ts (legacy style)
import { createServer } from "node:http";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import { MyRoom } from "./rooms/MyRoom";

const port = Number(process.env.PORT) || 2567;
const server = createServer();

const gameServer = new Server({
    transport: new WebSocketTransport({ server }),
});

gameServer.define("my_room", MyRoom);
gameServer.listen(port);
```

### Server Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `transport` | Required | Transport layer (WebSocket, uWebSockets, etc.) |
| `driver` | Required for scaling | Matchmaking driver for room storage/querying |
| `presence` | Required for scaling | Presence server for inter-process communication |
| `devMode` | `false` | Enable hot-reload development mode |
| `gracefullyShutdown` | `true` | Auto-register shutdown routine |
| `selectProcessIdToCreateRoom` | Least rooms | Custom logic for multi-process room creation |
| `isStandaloneMatchMaker` | `false` | Dedicated matchmaking process only |

## Room Definition

### Basic Room

```typescript
import { Room, Client } from "colyseus";
import { MyState } from "./MyState";

export class MyRoom extends Room {
    state = new MyState();

    onCreate(options: any) {
        // Room initialization
        this.maxClients = 8;
        this.setMetadata({ difficulty: "hard" });
    }

    async onAuth(client: Client, options: any, context: AuthContext) {
        // Validate auth token
        const user = await validateToken(context.token);
        if (!user) throw new Error("Unauthorized");
        return user;
    }

    onJoin(client: Client, options: any, auth: any) {
        // Add player to state
        this.state.players.set(client.sessionId, new Player());
    }

    onDrop(client: Client, code?: number) {
        // Unexpected disconnection - allow reconnection
        this.allowReconnection(client, 20);
    }

    onReconnect(client: Client) {
        // Client reconnected successfully
    }

    onLeave(client: Client, code?: number) {
        // Client left (consented)
        this.state.players.delete(client.sessionId);
    }

    onDispose() {
        // Cleanup when room is destroyed
    }
}
```

### Full Type Safety

```typescript
import { Room, type Client as MyClient } from "colyseus";
import { MyState } from "./MyState";

interface MyMetadata {
    difficulty: string;
    rating: number;
}

type Client = MyClient<{
    messages: {
        welcome: string;
        action: { type: string; data: any };
    }
}>;

export class MyRoom extends Room<{
    state: MyState;
    metadata: MyMetadata;
    client: Client;
}> {
    state = new MyState();

    onCreate(options: MyMetadata) {
        this.metadata.difficulty = options.difficulty;
    }

    onJoin(client: Client, options: any) {
        client.send("welcome", "Welcome to the room!");
    }
}
```

### Room Lifecycle Events

| Event | When Called | Purpose |
|-------|-------------|---------|
| `onAuth(client, options, context)` | Before WebSocket handshake | Validate join token, return auth data or throw |
| `onCreate(options)` | Room first created | Initialize state, set metadata |
| `onJoin(client, options, auth)` | Client successfully joined | Add client to room state |
| `onDrop(client, code)` | Client disconnected unexpectedly | Call `allowReconnection()` here |
| `onReconnect(client)` | Client reconnected | Restore client state |
| `onLeave(client, code)` | Client intentionally left | Clean up client from state |
| `onDispose()` | Room being destroyed | Persist data, stop actors |
| `onUncaughtException(err, method)` | Unhandled exception in room | Error handling |

### Message Handling

```typescript
export class MyRoom extends Room {
    state = new MyState();

    messages = {
        // Specific message type
        "action": (client, payload) => {
            console.log(client.sessionId, "sent action:", payload);
            this.broadcast("action-done", { player: client.sessionId });
        },

        // Fallback for all other messages
        "*": (client, type, payload) => {
            console.log("Unhandled message type:", type, payload);
        }
    }
}
```

### Message Validation with Zod

```typescript
import { Room, validate } from "colyseus";
import { z } from "zod";

export class MyRoom extends Room {
    messages = {
        "move": validate(
            z.object({ x: z.number(), y: z.number() }),
            (client, payload) => {
                // payload.x and payload.y are guaranteed to be numbers
                this.state.players.get(client.sessionId).x = payload.x;
                this.state.players.get(client.sessionId).y = payload.y;
            }
        )
    }
}
```

## Client SDK

### Client Setup

```typescript
import { Client } from "@colyseus/sdk";

const client = new Client("http://localhost:2567");

// With full-stack type safety (optional)
import type { server } from "../../server/src/app.config.ts";
const client = new Client<typeof server>("http://localhost:2567");
```

### Joining Rooms

```typescript
// Join or create (recommended)
const room = await client.joinOrCreate("battle", { mode: "duo" });

// Always create new room
const room = await client.create("battle", { map: "level1" });

// Join existing room only
const room = await client.join("battle", { team: "red" });

// Join by specific room ID (works even for private rooms)
const room = await client.joinById("room_abc123");

// Manual reconnection with token
const room = await client.reconnect(cachedReconnectionToken);
```

### Send and Receive Messages

```typescript
// Send message
room.send("move", { x: 10, y: 20 });
room.send(0, { type: "action", data: {} }); // Number type

// Send raw bytes
room.sendBytes("powerup", [172, 72, 101, 108, 108, 111]);

// Receive message
room.onMessage("powerup", (message) => {
    console.log("Received powerup:", message);
});

// Remove listener
room.offMessage("powerup");
```

### State Synchronization

```typescript
// Full state updates (less efficient)
room.onStateChange((state) => {
    console.log("State updated:", state);
});

// Recommended: Fine-grained callbacks with @colyseus/sdk
import { Callbacks } from "@colyseus/sdk";
const callbacks = Callbacks.get(room);

// Listen to specific property
callbacks.listen("currentTurn", (current, previous) => {
    console.log("Turn changed:", previous, "->", current);
});

// Listen to MapSchema additions
callbacks.onAdd("players", (player, sessionId) => {
    console.log("Player joined:", sessionId);
    callbacks.listen(player, "hp", (current, previous) => {
        console.log("Player HP changed:", previous, "->", current);
    });
});

// Listen to MapSchema removals
callbacks.onRemove("players", (player, sessionId) => {
    console.log("Player left:", sessionId);
});
```

### Connection Lifecycle

```typescript
// Leave room
room.leave();           // Consented leave (default)
room.leave(false);      // Force unconsented leave

// Listen for leave
room.onLeave((code) => {
    console.log("Left with code:", code);
});

// Automatic reconnection (enabled by default)
room.onDrop((code, reason) => {
    console.log("Connection dropped:", code, reason);
});

room.onReconnect(() => {
    console.log("Reconnected!");
});

// Error handling
room.onError((code, message) => {
    console.error("Room error:", code, message);
});

// Customize reconnection
room.reconnection.maxRetries = 10;
room.reconnection.maxDelay = 10000; // 10 seconds
room.reconnection.minUptime = 3000; // 3 seconds
room.reconnection.backoff = (attempt, delay) => {
    return Math.floor(Math.pow(2, attempt) * delay);
};
```

### Latency Measurement

```typescript
// Measure latency before joining
const latency = await client.getLatency();
const avgLatency = await client.getLatency({ pingCount: 5 });

// Measure latency during connection
room.ping((latency) => {
    console.log("Ping:", latency, "ms");
});

// Multi-region selection
const client = await Client.selectByLatency([
    "https://us-east.gameserver.com",
    "https://eu-west.gameserver.com",
    "https://asia.gameserver.com",
]);
```

### HTTP Requests

```typescript
// GET
const response = await client.http.get("/profile");

// POST
const response = await client.http.post("/profile", {
    body: { name: "Jake" }
});

// PUT
const response = await client.http.put("/profile", {
    body: { name: "Jake" }
});

// DELETE
const response = await client.http.delete("/profile");
```

## Room Properties

| Property | Type | Description |
|----------|------|-------------|
| `roomId` | `string` | Unique room identifier |
| `roomName` | `string` | Name of the room handler |
| `state` | `State` | Synchronized room state |
| `metadata` | `Metadata` | Room metadata for matchmaking |
| `clients` | `ClientArray` | Array of connected clients |
| `locked` | `boolean` | Whether room is locked/full (read-only) |

## Client Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | `string` | Unique client connection ID |
| `userData` | `any` | Server-side custom data storage |
| `auth` | `any` | Auth data from `onAuth()` |
| `view` | `StateView` | State filtering for this client |
| `reconnectionToken` | `string` | Token for manual reconnection |

## Room Configuration Properties

| Property | Default | Description |
|----------|---------|-------------|
| `maxClients` | `Infinity` | Maximum clients allowed |
| `patchRate` | `50` | State update frequency (ms) - 20fps default |
| `autoDispose` | `true` | Auto-dispose when empty |
| `maxMessagesPerSecond` | `Infinity` | Rate limit per client |
| `seatReservationTimeout` | `15` | Seconds to wait for join after seat reservation |

## WebSocket Close Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1000 | `CLOSE_NORMAL` | Normal closure |
| 1001 | `CLOSE_GOING_AWAY` | Browser tab closing |
| 1006 | `CLOSE_ABNORMAL` | No close code received |
| **4000** | **`CONSENTED`** | Client left intentionally |
| **4001** | **`SERVER_SHUTDOWN`** | Server graceful shutdown |
| **4002** | **`WITH_ERROR`** | Closed due to error |
| **4003** | **`FAILED_TO_RECONNECT`** | All reconnection attempts failed |
| **4010** | **`MAY_TRY_RECONNECT`** | Server shutdown in dev mode |
| 4011-4999 | - | Available for custom use |

> **Important:** Colyseus uses codes 4000-4010 internally. Avoid using these for custom purposes.

## Best Practices in This Project

- **Initialise `this.state` as a class property**, not inside `onCreate`. This ensures type inference works cleanly and state is always defined.
- **All message validation goes through Zod** before touching `this.state`. Parse in `onMessage`, reject silently on `safeParse` failure.
- **Drive game logic from XState.** `onMessage` → `actor.send(event)`. Don't write game rules directly in message handlers.
- **Always handle `allowReconnection` in `onDrop`, not `onLeave`.** `onDrop` fires on abnormal disconnects; `onLeave` with consented=true means intentional leave.
- **Use `this.clock` timers, not raw `setTimeout`.** Room-managed timers are automatically cancelled on disposal, preventing leaks.
- **Set `this.maxClients`** to the expected player count in `onCreate` to prevent overcrowded rooms.
- **Don't block `onJoin`/`onLeave` with slow async work.** Use `onAuth` for auth checks (it's allowed to be async) and defer DB writes to `onDispose`.

## Common Functions/Methods

| Function | Description |
|----------|-------------|
| `onCreate(options)` | Room initialisation. Set up state, register `onMessage` handlers, start timers. |
| `onAuth(client, options, context)` | Validate a join token before the WebSocket handshake completes. Return auth data or throw to reject. |
| `onJoin(client, options, auth)` | Client successfully joined. Add the player to `this.state`. |
| `onDrop(client, code?)` | Client disconnected unexpectedly. Mark player inactive; call `allowReconnection` here. |
| `onReconnect(client)` | Client successfully reconnected after `allowReconnection`. Restore active status. |
| `onLeave(client, code?)` | Client effectively left (after reconnection window or voluntary). Clean up player data. |
| `onDispose()` | Room is being destroyed. Persist final game state, stop actors. |
| `this.onMessage(type, handler)` | Register a typed message handler for messages sent from clients. |
| `client.send(type, payload)` | Send a MsgPack-encoded message to a specific client. |
| `this.broadcast(type, payload, options?)` | Send a message to all connected clients; use `{ except: client }` to exclude sender. |
| `this.lock()` / `this.unlock()` | Prevent or allow new clients from joining. |
| `this.allowReconnection(client, seconds)` | Hold a seat for a dropped client for `seconds` seconds. Returns a Deferred. |
| `this.setSimulationInterval(fn, ms)` | Register a game loop tick. Runs server-side on an interval. |
| `this.clock.setTimeout` / `.setInterval` | Room-managed timers that are automatically cleared on `onDispose`. |

## References

- [Official Docs](https://docs.colyseus.io)
- [Room API](https://docs.colyseus.io/room)
- [Client SDK](https://docs.colyseus.io/sdk)
- [Server API](https://docs.colyseus.io/server)
- [State Synchronization](https://docs.colyseus.io/state)
- [Migration Guide v0.17](https://docs.colyseus.io/migrating/0.17)
- [GitHub](https://github.com/colyseus/colyseus)
- [Discord Community](http://chat.colyseus.io/)
