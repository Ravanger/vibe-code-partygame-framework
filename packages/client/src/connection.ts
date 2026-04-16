import { Client, type Room } from "colyseus.js";
import type { ConnectionStatus } from "./types.js";

export class GameConnectionManager {
  public connectionStatus: ConnectionStatus = "disconnected";
  public room?: Room<unknown>;
  private client: Client;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async connect(roomName: string, options: Record<string, unknown> = {}) {
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.joinOrCreate<unknown>(roomName, options);
      this.connectionStatus = "connected";
      return this.room;
    } catch (e) {
      this.connectionStatus = "error";
      throw e;
    }
  }
}
