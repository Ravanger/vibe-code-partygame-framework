/**
 * Database module for Party Game Framework
 *
 * This module provides database integration for game state persistence.
 * Currently, an in-memory implementation is provided for development.
 *
 * Future implementations:
 * - Firebase Realtime Database
 * - Supabase
 * - MongoDB Atlas
 * - Redis
 */

export * from "./GameDatabase.js";
export * from "./types.js";

// Re-export for convenience
import { createDatabase, GameDatabase, MemoryDatabase } from "./GameDatabase.js";
import type { DatabaseConfig, DatabaseResult, DatabaseStatus } from "./types.js";

export type { DatabaseConfig, DatabaseResult, DatabaseStatus };
export { createDatabase, GameDatabase, MemoryDatabase };
