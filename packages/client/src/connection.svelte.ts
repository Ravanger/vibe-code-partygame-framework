import { Client, type Room } from "@colyseus/sdk";
import type { ConnectionStatus } from "./types.js";

export class GameConnectionManager {
  public connectionStatus: ConnectionStatus = $state("disconnected");
  public room: Room<unknown> | undefined = $state();
  private client: Client;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
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
