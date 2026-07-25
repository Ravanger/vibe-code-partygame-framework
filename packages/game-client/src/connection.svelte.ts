import { Client, type Room } from "@colyseus/sdk";
import type { ConnectionStatus } from "./types.js";

export class GameConnectionManager {
  public connectionStatus: ConnectionStatus = "disconnected";
  public room: Room<unknown> | undefined;
  public error: string | undefined;
  private client: Client;
  private apiBaseUrl: string;

  constructor(endpoint: string, apiPort: number = 3001) {
    this.client = new Client(endpoint);
    // Extract hostname from endpoint for API calls
    const url = new URL(endpoint);
    this.apiBaseUrl = `${url.protocol}//${url.hostname}:${apiPort}`;
  }

  async create(roomName: string, options: Record<string, unknown> = {}) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.create<unknown>(roomName, options);
      this.connectionStatus = "connected";
      this.room.onLeave(() => {
        this.connectionStatus = "disconnected";
        this.room = undefined;
      });
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
      this.room = await this.client.joinById<unknown>(options.code as string, options);
      this.connectionStatus = "connected";
      this.room.onLeave(() => {
        this.connectionStatus = "disconnected";
        this.room = undefined;
      });
      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  async joinByCode(code: string) {
    this.error = undefined;
    this.connectionStatus = "connecting";
    try {
      // First, resolve the 4-letter code to a roomId via API
      const cleanCode = code.trim().toUpperCase();
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
      // Now join the room using the resolved roomId
      this.room = await this.client.joinById<unknown>(data.roomId);
      this.connectionStatus = "connected";
      this.room.onLeave(() => {
        this.connectionStatus = "disconnected";
        this.room = undefined;
      });
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
      this.room = await this.client.joinOrCreate<unknown>(roomName, options);
      this.connectionStatus = "connected";

      this.room.onLeave((_code) => {
        this.connectionStatus = "disconnected";
        this.room = undefined;
      });

      return this.room;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      console.error("[GameConnectionManager] Connection failed:", e);
      this.connectionStatus = "error";
      throw e;
    }
  }

  /** Return to a clean disconnected state so the user can try again. */
  reset() {
    this.room = undefined;
    this.error = undefined;
    this.connectionStatus = "disconnected";
  }
}
