/**
 * Database types and interfaces for the Party Game framework
 */

/**
 * Base database configuration
 */
export interface DatabaseConfig {
  provider: "firebase" | "supabase" | "mongodb" | "redis" | "memory";
  firebase?: FirebaseConfig;
  supabase?: SupabaseConfig;
  mongodb?: MongoDBConfig;
  redis?: RedisConfig;
  // Enable/disable automatic persistence
  autoSave?: boolean;
  // Interval for auto-saving room state (in seconds)
  autoSaveInterval?: number;
}

/**
 * Firebase configuration
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  url: string;
  key: string;
}

/**
 * MongoDB configuration
 */
export interface MongoDBConfig {
  uri: string;
  dbName?: string;
}

/**
 * Redis configuration
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/**
 * Game room state data for persistence
 */
export interface RoomStateData {
  id: string;
  code: string;
  name: string;
  phase: string;
  state: Record<string, unknown>;
  players: Array<{
    id: string;
    name: string;
    role: string;
    isReady: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

/**
 * Player data for persistence
 */
export interface PlayerData {
  id: string;
  name: string;
  totalGames: number;
  totalWins: number;
  totalPoints: number;
  lastActive: Date;
  preferences?: {
    theme?: string;
    sound?: boolean;
    animations?: boolean;
  };
  createdAt: Date;
}

/**
 * Database connection status
 */
export type DatabaseStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Database error
 */
export interface DatabaseError {
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Result of a database operation
 */
export interface DatabaseResult<T = void> {
  success: boolean;
  data?: T;
  error?: DatabaseError;
  timestamp: Date;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalRooms: number;
  totalPlayers: number;
  storageUsed: number; // in bytes
  readCount: number;
  writeCount: number;
  lastBackup: Date | null;
}

/**
 * Database health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latency: number; // in ms
  status: DatabaseStatus;
  timestamp: Date;
  version?: string;
}

/**
 * Room query options
 */
export interface RoomQueryOptions {
  includePlayers?: boolean;
  includeState?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "updatedAt" | "lastActivityAt";
  sortOrder?: "asc" | "desc";
}

/**
 * Player query options
 */
export interface PlayerQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: "totalGames" | "totalWins" | "totalPoints" | "lastActive" | "createdAt";
  sortOrder?: "asc" | "desc";
}
