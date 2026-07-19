# Game Database Integration

## Overview

This directory contains database integration scaffolding for the Party Game framework. Currently, the game uses in-memory state via Colyseus. For production deployments with persistence and scalability, you can integrate with various database providers.

## Supported Providers (Future)

### Free Tier Options

| Provider | Status | Notes |
|----------|--------|-------|
| **Firebase Realtime Database** | Planned | Free tier: 1GB storage, 10GB/month downloads |
| **Supabase** | Planned | Free tier: 500MB database, 2GB bandwidth |
| **MongoDB Atlas** | Planned | Free tier: 512MB storage |
| **Redis (Upstash)** | Planned | Free tier: 10,000 commands/day |

### Current State

Currently, all game state is managed in-memory by Colyseus. Each room maintains its own state, and rooms are created/destroyed dynamically.

## Integration Architecture

### Interface

All database providers should implement the `GameDatabase` interface:

```typescript
interface GameDatabase {
  // Initialize the database connection
  connect(config: DatabaseConfig): Promise<void>;
  
  // Disconnect from the database
  disconnect(): Promise<void>;
  
  // Save game room state
  saveRoomState(roomId: string, state: unknown): Promise<void>;
  
  // Load game room state
  loadRoomState(roomId: string): Promise<unknown | null>;
  
  // Delete game room state
  deleteRoomState(roomId: string): Promise<void>;
  
  // Save player data
  savePlayerData(playerId: string, data: unknown): Promise<void>;
  
  // Load player data
  loadPlayerData(playerId: string): Promise<unknown | null>;
  
  // List active rooms (for room discovery)
  listRooms(): Promise<string[]>;
  
  // Health check
  ping(): Promise<boolean>;
}
```

### Usage

To enable database persistence:

1. Choose a provider (e.g., Firebase)
2. Install dependencies: `bun add firebase`
3. Create configuration in `database/config.ts`
4. Initialize the database in `index.ts`
5. Pass the database instance to GameRoom

## Configuration

Create a `database/config.ts` file:

```typescript
import type { DatabaseConfig } from "./types";

export const databaseConfig: DatabaseConfig = {
  provider: "firebase", // or "supabase", "mongodb", etc.
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  // ... other providers
};
```

## Environment Variables

For security, use environment variables for credentials:

```bash
# Firebase
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
```

## Room Code Persistence

Currently, room codes are generated and managed by `RoomCodeService`. With database integration, you can:

1. Store room codes in the database
2. Retrieve room codes after server restart
3. Allow players to reconnect to existing rooms

## Player Data Persistence

With database integration, you can:

1. Save player names and preferences
2. Track player statistics across sessions
3. Implement player profiles

## Implementation Notes

### Colyseus Integration

Colyseus already supports Redis for room state persistence. You can configure this in the server:

```typescript
import { RedisPresence } from "@colyseus/presence-redis";
import { RedisDriver } from "@colyseus/driver-redis";

const gameServer = new Server({
  presence: new RedisPresence({
    host: "localhost",
    port: 6379,
  }),
  driver: new RedisDriver({
    host: "localhost",
    port: 6379,
  }),
});
```

### Room State Serialization

When saving room state to a database, ensure proper serialization:

```typescript
import { SchemaSerializer } from "@colyseus/schema";

const serializer = new SchemaSerializer();
const stateData = serializer.serialize(room.state);
// Save stateData to database
```

## TODO

- [ ] Implement Firebase provider
- [ ] Implement Supabase provider
- [ ] Implement MongoDB provider
- [ ] Add database health checks
- [ ] Add automatic reconnection logic
- [ ] Add data migration scripts
- [ ] Add backup/restore functionality
