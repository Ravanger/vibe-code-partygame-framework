import { Client, type Room } from "@colyseus/sdk";
import type { ConnectionStatus } from "./types.js";

const PLAYER_ID_KEY = "witclash.playerId";
const RECONNECTION_TOKEN_KEY = "witclash.reconnectionToken";
const LAST_ROOM_CODE_KEY = "lastRoomCode";

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Private mode / storage full
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore
  }
}

export class GameConnectionManager {
  public connectionStatus: ConnectionStatus = "disconnected";
  public room: Room<unknown> | undefined;
  public error: string | undefined;
  public stateVersion: number = 0;
  private client: Client;
  private apiBaseUrl: string;
  private playerId: string;
  private joinedCode: string | undefined;
  private pendingJoin: { code: string; promise: Promise<Room<unknown>> } | undefined;

  constructor(endpoint: string, apiPort: number = 3001) {
    this.client = new Client(endpoint);
    const url = new URL(endpoint);
    this.apiBaseUrl = `${url.protocol}//${url.hostname}:${apiPort}`;
    this.playerId = this.getOrCreatePlayerId();
  }

  private getOrCreatePlayerId(): string {
    const existing = safeGet(localStorage, PLAYER_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    safeSet(localStorage, PLAYER_ID_KEY, id);
    return id;
  }

  private attachRoomHandlers(): void {
    if (!this.room) return;
    this.room.onStateChange(() => {
      this.stateVersion += 1;
    });
    this.room.onLeave(() => {
      this.connectionStatus = "disconnected";
      this.room = undefined;
      this.joinedCode = undefined;
    });
  }

  private persistConnectionMetadata(): void {
    if (!this.room) return;
    safeSet(sessionStorage, RECONNECTION_TOKEN_KEY, this.room.reconnectionToken);
    const state = this.room.state as { roomCode?: string };
    if (state?.roomCode) {
      safeSet(localStorage, LAST_ROOM_CODE_KEY, state.roomCode);
    }
  }

  async create(roomName: string, options: Record<string, unknown> = {}) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.create<unknown>(roomName, {
        ...options,
        playerId: this.playerId,
      });
      this.connectionStatus = "connected";
      this.attachRoomHandlers();
      this.persistConnectionMetadata();
      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  async join(_roomName: string, options: Record<string, unknown> = {}) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.joinById<unknown>(options.code as string, {
        ...options,
        playerId: this.playerId,
      });
      this.connectionStatus = "connected";
      this.attachRoomHandlers();
      this.persistConnectionMetadata();
      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  async joinByCode(code: string) {
    const cleanCode = code.trim().toUpperCase();

    // A double-tapped Join button must not open a second room: the later join would
    // overwrite this.room, leaking the first (never left) and seating the same person
    // twice on the server. Joining a *different* code still starts a fresh join.
    if (this.room && this.joinedCode === cleanCode) return this.room;
    if (this.pendingJoin?.code === cleanCode) return this.pendingJoin.promise;

    const promise = this.performJoinByCode(cleanCode);
    this.pendingJoin = { code: cleanCode, promise };
    try {
      return await promise;
    } finally {
      this.pendingJoin = undefined;
    }
  }

  private async performJoinByCode(cleanCode: string) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      if (!/^[A-Z]{4}$/.test(cleanCode)) {
        throw new Error("Game code must be 4 uppercase letters");
      }

      console.log(
        `[GameConnectionManager] Resolving code ${cleanCode} via API at ${this.apiBaseUrl}/api/resolve-code?code=${cleanCode}`,
      );
      const response = await fetch(`${this.apiBaseUrl}/api/resolve-code?code=${cleanCode}`);
      console.log(`[GameConnectionManager] API response status: ${response.status}`);
      const data = await response.json();
      console.log(`[GameConnectionManager] API response data:`, data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to resolve game code");
      }

      if (!data.roomId) {
        throw new Error("Game code not found");
      }

      console.log(
        `[GameConnectionManager] Resolved code ${cleanCode} to roomId ${data.roomId}, joining room...`,
      );
      this.room = await this.client.joinById<unknown>(data.roomId, {
        playerId: this.playerId,
      });
      this.joinedCode = cleanCode;
      this.connectionStatus = "connected";
      this.attachRoomHandlers();
      this.persistConnectionMetadata();
      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  async connect(roomName: string, options: Record<string, unknown> = {}) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.joinOrCreate<unknown>(roomName, {
        ...options,
        playerId: this.playerId,
      });
      this.connectionStatus = "connected";
      this.attachRoomHandlers();
      this.persistConnectionMetadata();
      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  async tryReconnect(): Promise<boolean> {
    const token = safeGet(sessionStorage, RECONNECTION_TOKEN_KEY);
    if (token) {
      try {
        this.connectionStatus = "connecting";
        this.room = await this.client.reconnect(token);
        this.attachRoomHandlers();
        this.connectionStatus = "connected";
        return true;
      } catch {
        // Token expired — fall through to code-based rejoin
      }
    }

    const code = safeGet(localStorage, LAST_ROOM_CODE_KEY);
    if (code) {
      try {
        await this.joinByCode(code);
        return true;
      } catch {
        // Room gone — fall through to clean state
      }
    }

    this.clearSession();
    this.reset();
    return false;
  }

  clearSession(): void {
    safeRemove(sessionStorage, RECONNECTION_TOKEN_KEY);
    safeRemove(localStorage, LAST_ROOM_CODE_KEY);
  }

  reset(): void {
    this.room = undefined;
    this.joinedCode = undefined;
    this.error = undefined;
    this.connectionStatus = "disconnected";
  }
}
