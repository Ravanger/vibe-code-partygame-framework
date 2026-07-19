import type {
  DatabaseConfig,
  DatabaseStatus,
  DatabaseResult,
  RoomStateData,
  PlayerData,
  HealthCheckResult,
  RoomQueryOptions,
  PlayerQueryOptions,
  DatabaseStats,
} from "./types.js";

/**
 * Abstract base class for game database implementations
 * 
 * All database providers should extend this class and implement
 * the abstract methods.
 */
export abstract class GameDatabase {
  protected config: DatabaseConfig;
  protected _status: DatabaseStatus = "disconnected";
  protected _onConnect?: () => void;
  protected _onDisconnect?: () => void;
  protected _onError?: (error: Error) => void;

  /**
   * Create a new database instance
   * @param config Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Current connection status
   */
  getStatus(): DatabaseStatus {
    return this._status;
  }
  
  /**
   * Set connection status (protected for child classes)
   */
  protected setStatus(status: DatabaseStatus): void {
    this._status = status;
  }

  /**
   * Register event handlers
   */
  onConnect(callback: () => void): void {
    this._onConnect = callback;
  }

  onDisconnect(callback: () => void): void {
    this._onDisconnect = callback;
  }

  onError(callback: (error: Error) => void): void {
    this._onError = callback;
  }

  /**
   * Connect to the database
   */
  abstract connect(): Promise<DatabaseResult>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<DatabaseResult>;

  /**
   * Save game room state
   * @param roomId Room identifier
   * @param data Room state data
   */
  abstract saveRoomState(roomId: string, data: RoomStateData): Promise<DatabaseResult>;

  /**
   * Load game room state
   * @param roomId Room identifier
   */
  abstract loadRoomState(roomId: string): Promise<DatabaseResult<RoomStateData | null>>;

  /**
   * Delete game room state
   * @param roomId Room identifier
   */
  abstract deleteRoomState(roomId: string): Promise<DatabaseResult>;

  /**
   * List all active rooms
   * @param options Query options
   */
  abstract listRooms(options?: RoomQueryOptions): Promise<DatabaseResult<RoomStateData[]>>;

  /**
   * Save player data
   * @param playerId Player identifier
   * @param data Player data
   */
  abstract savePlayerData(playerId: string, data: PlayerData): Promise<DatabaseResult>;

  /**
   * Load player data
   * @param playerId Player identifier
   */
  abstract loadPlayerData(playerId: string): Promise<DatabaseResult<PlayerData | null>>;

  /**
   * Delete player data
   * @param playerId Player identifier
   */
  abstract deletePlayerData(playerId: string): Promise<DatabaseResult>;

  /**
   * Query players
   * @param options Query options
   */
  abstract queryPlayers(options?: PlayerQueryOptions): Promise<DatabaseResult<PlayerData[]>>;

  /**
   * Get database statistics
   */
  abstract getStats(): Promise<DatabaseResult<DatabaseStats>>;

  /**
   * Perform health check
   */
  abstract healthCheck(): Promise<HealthCheckResult>;

  /**
   * Clear all data (for testing or reset)
   */
  abstract clearAll(): Promise<DatabaseResult>;

  /**
   * Export all data for backup
   */
  abstract exportData(): Promise<DatabaseResult<{
    rooms: RoomStateData[];
    players: PlayerData[];
  }>>;

  /**
   * Import data from backup
   */
  abstract importData(data: {
    rooms: RoomStateData[];
    players: PlayerData[];
  }): Promise<DatabaseResult>;
}

/**
 * No-op database implementation for development/testing
 * This implementation does nothing and always succeeds.
 * Useful when you don't need database persistence.
 */
export class MemoryDatabase extends GameDatabase {
  private rooms = new Map<string, RoomStateData>();
  private players = new Map<string, PlayerData>();

  constructor() {
    super({ provider: "memory" });
    this.setStatus("connected");
  }

  async connect(): Promise<DatabaseResult> {
    this.setStatus("connected");
    return { success: true, timestamp: new Date() };
  }

  async disconnect(): Promise<DatabaseResult> {
    this.setStatus("disconnected");
    this.rooms.clear();
    this.players.clear();
    return { success: true, timestamp: new Date() };
  }

  async saveRoomState(roomId: string, data: RoomStateData): Promise<DatabaseResult> {
    this.rooms.set(roomId, data);
    return { success: true, timestamp: new Date() };
  }

  async loadRoomState(roomId: string): Promise<DatabaseResult<RoomStateData | null>> {
    const data = this.rooms.get(roomId) || null;
    return { success: true, data, timestamp: new Date() };
  }

  async deleteRoomState(roomId: string): Promise<DatabaseResult> {
    this.rooms.delete(roomId);
    return { success: true, timestamp: new Date() };
  }

  async listRooms(): Promise<DatabaseResult<RoomStateData[]>> {
    return { 
      success: true, 
      data: Array.from(this.rooms.values()),
      timestamp: new Date() 
    };
  }

  async savePlayerData(playerId: string, data: PlayerData): Promise<DatabaseResult> {
    this.players.set(playerId, data);
    return { success: true, timestamp: new Date() };
  }

  async loadPlayerData(playerId: string): Promise<DatabaseResult<PlayerData | null>> {
    const data = this.players.get(playerId) || null;
    return { success: true, data, timestamp: new Date() };
  }

  async deletePlayerData(playerId: string): Promise<DatabaseResult> {
    this.players.delete(playerId);
    return { success: true, timestamp: new Date() };
  }

  async queryPlayers(): Promise<DatabaseResult<PlayerData[]>> {
    return { 
      success: true, 
      data: Array.from(this.players.values()),
      timestamp: new Date() 
    };
  }

  async getStats(): Promise<DatabaseResult<DatabaseStats>> {
    let storageUsed = 0;
    for (const [, room] of this.rooms) {
      storageUsed += JSON.stringify(room).length;
    }
    for (const [, player] of this.players) {
      storageUsed += JSON.stringify(player).length;
    }
    
    return {
      success: true,
      data: {
        totalRooms: this.rooms.size,
        totalPlayers: this.players.size,
        storageUsed,
        readCount: 0,
        writeCount: 0,
        lastBackup: null,
      },
      timestamp: new Date(),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: true,
      latency: 0,
      status: this._status,
      timestamp: new Date(),
      version: "1.0.0",
    };
  }

  async clearAll(): Promise<DatabaseResult> {
    this.rooms.clear();
    this.players.clear();
    return { success: true, timestamp: new Date() };
  }

  async exportData(): Promise<DatabaseResult<{ rooms: RoomStateData[]; players: PlayerData[] }>> {
    return {
      success: true,
      data: {
        rooms: Array.from(this.rooms.values()),
        players: Array.from(this.players.values()),
      },
      timestamp: new Date(),
    };
  }

  async importData(data: { rooms: RoomStateData[]; players: PlayerData[] }): Promise<DatabaseResult> {
    this.rooms.clear();
    this.players.clear();
    for (const room of data.rooms) {
      this.rooms.set(room.id, room);
    }
    for (const player of data.players) {
      this.players.set(player.id, player);
    }
    return { success: true, timestamp: new Date() };
  }
}

/**
 * Factory function to create a database instance based on configuration
 */
export function createDatabase(config: DatabaseConfig): GameDatabase {
  switch (config.provider) {
    case "memory":
      return new MemoryDatabase();
    case "firebase":
    case "supabase":
    case "mongodb":
    case "redis":
      console.warn(
        `[Database] Provider '${config.provider}' is not yet implemented. ` +
        `Falling back to memory database. Please implement the provider in the database directory.`
      );
      return new MemoryDatabase();
    default:
      return new MemoryDatabase();
  }
}
