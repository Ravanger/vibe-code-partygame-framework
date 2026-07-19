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

export * from "./types.js";
export * from "./GameDatabase.js";

// Re-export for convenience
import { MemoryDatabase, createDatabase, GameDatabase } from "./GameDatabase.js";
import type { DatabaseConfig, DatabaseResult, DatabaseStatus } from "./types.js";

export { MemoryDatabase, createDatabase, GameDatabase };
export type { DatabaseConfig, DatabaseResult, DatabaseStatus };
