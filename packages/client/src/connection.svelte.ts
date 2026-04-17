import { Client, type Room } from "@colyseus/sdk";
import type { ConnectionStatus } from "./types.js";

export class GameConnectionManager {
  public connectionStatus: ConnectionStatus = $state("disconnected");
  public room: Room<unknown> | undefined = $state();
  private client: Client;
  private apiBaseUrl: string;

  constructor(endpoint: string, apiPort: number = 3001) {
    this.client = new Client(endpoint);
    // Extract hostname from endpoint for API calls
    const url = new URL(endpoint);
    this.apiBaseUrl = `${url.protocol}//${url.hostname}:${apiPort}`;
  }

  async create(roomName: string, options: Record<string, unknown> = {}) {
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
      this.connectionStatus = "error";
      throw e;
    }
  }

  async join(_roomName: string, options: Record<string, unknown> = {}) {
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
      this.connectionStatus = "error";
      throw e;
    }
  }

  async joinByCode(code: string) {
    this.connectionStatus = "connecting";
    try {
      // First, resolve the 4-letter code to a roomId via API
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(cleanCode)) {
        throw new Error("Game code must be 4 uppercase letters");
      }

      const response = await fetch(`${this.apiBaseUrl}/api/resolve-code?code=${cleanCode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resolve game code");
      }

      if (!data.roomId) {
        throw new Error("Game code not found");
      }

      // Now join the room using the resolved roomId
      this.room = await this.client.joinById<unknown>(data.roomId);
      this.connectionStatus = "connected";
      this.room.onLeave(() => {
        this.connectionStatus = "disconnected";
        this.room = undefined;
      });
      return this.room;
    } catch (e) {
      this.connectionStatus = "error";
      throw e;
    }
  }

  async connect(roomName: string, options: Record<string, unknown> = {}) {
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
      this.connectionStatus = "error";
      throw e;
    }
  }
}
