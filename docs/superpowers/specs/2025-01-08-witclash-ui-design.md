# WitClash UI - 4-Letter Code Integration Design

**Date:** 2025-01-08
**Status:** Approved
**Author:** Mistral Vibe

## Overview

This document describes the design for implementing a full 4-letter room code system for WitClash, fixing the bug where every player becomes host, and enabling the proper game flow as specified.

## Problem Statement

1. **Bug:** Every player that joins becomes the host because `App.svelte` passes `createGameOnLoad={true}` to all players
2. **Missing Feature:** Proper 4-letter code system for game joining
3. **Missing Feature:** Scoreboard display in Results screen

## Architecture

### Room Code Service

A server-side service (`RoomCodeService`) that:
- Generates unique 4-letter codes (A-Z, uppercase)
- Maintains bidirectional mapping between codes and Colyseus roomIds
- Provides methods for registration, resolution, and unregistration
- Handles collisions with retry logic (max 10 attempts)

**Code Generation Algorithm:**
- Characters: A-Z (26 options)
- Length: 4 characters
- Total space: 26^4 = 456,976 unique codes
- Generation: Random selection with collision detection

### HTTP API for Code Resolution

Since Colyseus clients cannot directly query the server's code registry, a lightweight HTTP API is added:

- **Endpoint:** `GET /api/resolve-code?code=ABCD`
- **Port:** 3001 (separate from game server port 2567)
- **Response:** `{ roomId: "room-123" }` or error
- **Validation:** 4 uppercase letters only

### Modified Flow

#### Host Flow:
1. User loads `http://localhost:5173/?host=true`
2. App detects `?host=true` URL parameter
3. Lobby receives `createGameOnLoad={true}`
4. Lobby auto-calls `manager.create("wit_clash")`
5. Server creates room, generates 4-letter code, registers `code -> roomId`
6. Server returns room with state containing `roomCode`
7. Host sees "Name Entry" screen with room code displayed
8. Host enters name, clicks "Join Lobby"
9. Host sees Waiting Room with game code and Start Game button

#### Guest Flow:
1. User loads `http://localhost:5173/`
2. App passes `createGameOnLoad={false}` to Lobby
3. Lobby shows "Join a Game" OR "Host a New Game"
4. Guest enters 4-letter code
5. Lobby calls `manager.joinByCode(code)`
6. Client fetches `/api/resolve-code?code=ABCD` to get `roomId`
7. Client calls `joinById(roomId)`
8. Server onJoin adds player with role="player" (not host)
9. Guest enters name, joins lobby
10. Guest sees Waiting Room

## Component Changes

### Server (`packages/server`)

| File | Change |
|------|--------|
| `src/services/RoomCodeService.ts` | New service for code generation and mapping |
| `src/index.ts` | Add HTTP API server on port 3001, inject RoomCodeService |
| `src/rooms/GameRoom.ts` | Accept RoomCodeService, register code onCreate, unregister onDispose |

### Client (`packages/client`)

| File | Change |
|------|--------|
| `src/connection.svelte.ts` | Add `joinByCode(code)` method |

### WitClash Game (`games/wit-clash`)

| File | Change |
|------|--------|
| `ui/App.svelte` | Detect `?host=true` URL param, pass to Lobby |
| `ui/Lobby.svelte` | Use `joinByCode()` for guest joining, display `state.roomCode`, fix createGameOnLoad |
| `ui/main.ts` | Pass API port (3001) to GameConnectionManager |
| `ui/Results.svelte` | Display sorted scoreboard from `state.publicData.scores` |
| `tests/App.test.ts` | Update assertions for new UI text |
| `tests/Results.test.ts` | New tests for scoreboard |

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid code format | Client-side: "Game code must be 4 uppercase letters" |
| Code not found | API returns 404, client shows "Game code not found" |
| Room full | Colyseus reject, client shows error |
| Connection failure | Existing error display logic |
| Code collision | Server retries up to 10 times, throws error if exhausted |

## Future Considerations

1. **Redis Backing:** Replace in-memory Map with Redis for multi-node support
2. **Code Expiry:** Add TTL to codes for automatic cleanup
3. **Custom Codes:** Allow hosts to choose their own code (with validation)
4. **Room Listing:** Add endpoint to list active games for discovery
5. **Rate Limiting:** Add rate limiting to code resolution endpoint

## Testing Strategy

- Unit tests for RoomCodeService
- Integration tests for join flow
- Manual testing for full game cycle
- Test coverage target: 100% for new code, maintain existing coverage

## Approval

Approved by user on 2025-01-08 with "ltgm"
