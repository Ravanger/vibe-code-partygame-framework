# @colyseus/ws-transport Documentation

> **Version:** v0.17.13
> **Package:** `@colyseus/ws-transport@^0.17.13`

## Overview

`@colyseus/ws-transport` is the WebSocket transport layer implementation for Colyseus, enabling real-time communication between the game server and connected clients over standard WebSocket connections. In the `vibe-coded` party game framework, this is the default transport mechanism used for all client-server communication on Node.js and Bun runtimes.

This package handles the low-level WebSocket protocol details, including message serialization, connection management, ping/pong heartbeats, and automatic reconnection support.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **WebSocketTransport** | The main transport class that implements the Colyseus `Transport` interface using Node.js/Bun WebSocket APIs. |
| **Server Integration** | Attaches to an HTTP server to handle WebSocket upgrade requests from clients. |
| **Ping/Pong** | Built-in keep-alive mechanism to detect and handle dropped connections. |
| **Message Serialization** | Handles serialization/deserialization of Colyseus messages over WebSocket. |
| **Upgrade Protocol** | Manages the HTTP-to-WebSocket upgrade handshake for seat reservation. |

## Common Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | `http.Server \| https.Server` | Required | HTTP server to attach WebSocket transport to. |
| `pingInterval` | `number` | `3000` | Milliseconds between ping messages to clients. |
| `maxPayload` | `number` | `1024 * 1024` (1MB) | Maximum message size in bytes. |
| `verifyClient` | `function` | `undefined` | Custom verification callback for WebSocket upgrade requests. |
| `path` | `string` | `/colyseus` | URL path for WebSocket connections. |

## Installation

```bash
# Using Bun (recommended)
bun add @colyseus/ws-transport

# Using npm
npm install @colyseus/ws-transport

# Using pnpm
pnpm add @colyseus/ws-transport

# Using Yarn
yarn add @colyseus/ws-transport
```

## Basic Usage

### Server Setup

```typescript
import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

const port = 2567;
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 10000,       // 10-second ping interval
    maxPayload: 1024 * 1024,  // 1MB max message size
  }),
});

gameServer.listen(port);
```

### Server Setup with Custom Path

```typescript
import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    path: "/ws",  // Custom WebSocket path
  }),
});

// Server will accept WebSocket connections at ws://localhost:2567/ws
gameServer.listen(2567);
```

## Best Practices in This Project

- **Use default settings for most applications.** The default `pingInterval` (3 seconds) and `maxPayload` (1MB) work well for party games with typical message sizes.
- **Increase `maxPayload` for large state snapshots.** If your game broadcasts large initial state objects, increase this to accommodate.
- **Adjust `pingInterval` for mobile clients.** Mobile networks may need longer intervals (5-10 seconds) to reduce battery impact.
- **Use custom `path` for co-located servers.** If your game server shares a domain with a web server, use a dedicated path like `/colyseus`.
- **Enable `verifyClient` for production security.** Implement custom verification to prevent unauthorized connections in production.

## Project Integration

### Actual Project Usage

**`packages/server/src/index.ts`:**
```typescript
import { createServer } from "node:http";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT) || 2567;
const server = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,  // Attach to HTTP server
  }),
});

gameServer.define("wit_clash", GameRoom);
gameServer.listen(port);
```

## Troubleshooting

### Connection Dropped Immediately

**Symptom:** Clients disconnect immediately after connecting.
**Solution:** Check that the `server` option is correctly passed to `WebSocketTransport`. The HTTP server must be listening before WebSocket connections are accepted.

### Message Too Large Errors

**Symptom:** `Error: Message too large` in server logs.
**Solution:** Increase the `maxPayload` option to accommodate your largest expected message.

### Ping Timeouts

**Symptom:** Clients disconnect with ping timeout errors.
**Solution:** Reduce `pingInterval` or check for network/firewall issues blocking WebSocket traffic.

## References

- [Official Docs](https://docs.colyseus.io)
- [API Reference](https://docs.colyseus.io/api/ws-transport)
- [GitHub Repository](https://github.com/colyseus/colyseus)
- [LLM Index](https://docs.colyseus.io/llms.txt)
