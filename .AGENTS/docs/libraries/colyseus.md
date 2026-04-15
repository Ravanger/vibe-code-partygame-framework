# Colyseus Documentation

> **Package:** `colyseus` (server), `colyseus.js` (client)

## Overview

Colyseus is the real-time multiplayer framework at the core of `vibe-coded`. It manages WebSocket connections, room matchmaking, client sessions, and state synchronisation between the Node.js game server and all connected devices. Each party game is a `Room` subclass — players join rooms, the server mutates a `@colyseus/schema` state object, and Colyseus delta-encodes and broadcasts changes to all clients automatically.

## Key Concepts

- **Room:** A server-side class extending `Room<StateType>`. Encapsulates a game session's lifecycle, player registry, and message handling.
- **Client:** Represents a connected player. Has a `sessionId` (unique per connection), `userData` (server-only custom bag), and `auth` (value returned from `onAuth`).
- **State Synchronisation:** Assign a `@colyseus/schema` instance via `this.state = new MyState()` in the class body (or `this.setState()` in older patterns). Colyseus diffs and pushes delta patches to clients on every simulation interval.
- **Matchmaking:** Clients call `client.joinOrCreate("room_name", options)`. The server uses `gameServer.define("room_name", MyRoom)` to register rooms. Colyseus handles room creation and recycling automatically.
- **`allowReconnection`:** Called inside `onLeave` to hold a seat open for a dropped client. Returns a deferred that resolves on successful reconnect or rejects after a timeout.
- **`onDrop`:** Called when a client disconnects unexpectedly (before the reconnection window). Use here to mark the player inactive.
- **Server Define API:** `defineServer({ rooms, express, routes })` — new Vite-plugin-friendly entry point that co-locates server setup.

## Common Functions/Methods

| Function | Description |
|---|---|
| `onCreate(options)` | Room initialisation. Set up state, register `onMessage` handlers, start timers. |
| `onAuth(client, options, context)` | Validate a join token before the WebSocket handshake completes. Return auth data or throw to reject. |
| `onJoin(client, options, auth)` | Client successfully joined. Add the player to `this.state`. |
| `onDrop(client, code?)` | Client disconnected unexpectedly. Mark player inactive; call `allowReconnection` here. |
| `onReconnect(client)` | Client successfully reconnected after `allowReconnection`. Restore active status. |
| `onLeave(client, consented)` | Client effectively left (after reconnection window or voluntary). Clean up player data. |
| `onDispose()` | Room is being destroyed. Persist final game state, stop actors. |
| `this.onMessage(type, handler)` | Register a typed message handler for messages sent from clients. |
| `client.send(type, payload)` | Send a MsgPack-encoded message to a specific client. |
| `this.broadcast(type, payload, options?)` | Send a message to all connected clients; use `{ except: client }` to exclude sender. |
| `this.lock()` / `this.unlock()` | Prevent or allow new clients from joining. |
| `this.allowReconnection(client, seconds)` | Hold a seat for a dropped client for `seconds` seconds. Returns a Deferred. |
| `this.setSimulationInterval(fn, ms)` | Register a game loop tick. Runs server-side on an interval. |
| `this.clock.setTimeout` / `.setInterval` | Room-managed timers that are automatically cleared on `onDispose`. |

## Best Practices in This Project

- **Initialise `this.state` as a class property**, not inside `onCreate`. This ensures type inference works cleanly and state is always defined.
- **All message validation goes through Zod** before touching `this.state`. Parse in `onMessage`, reject silently on `safeParse` failure.
- **Drive game logic from XState.** `onMessage` → `actor.send(event)`. Don't write game rules directly in message handlers.
- **Always handle `allowReconnection` in `onDrop`, not `onLeave`.** `onDrop` fires on abnormal disconnects; `onLeave` with `consented=true` means intentional leave.
- **Use `this.clock` timers, not raw `setTimeout`.** Room-managed timers are automatically cancelled on disposal, preventing leaks.
- **Set `this.maxClients`** to the expected player count in `onCreate` to prevent overcrowded rooms.
- **Don't block `onJoin`/`onLeave` with slow async work.** Use `onAuth` for auth checks (it's allowed to be async) and defer DB writes to `onDispose`.

## References

- [Official Docs](https://docs.colyseus.io)
- [Room API](https://docs.colyseus.io/room)
- [Client SDK](https://docs.colyseus.io/client)
