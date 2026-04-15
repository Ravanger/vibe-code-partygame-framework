import { Client, Room } from "colyseus.js";
import { GameRoomState, type ServerGameRoomState } from "./state.svelte.js";
import type { ConnectionStatus } from "./types.js";

export class GameClient {
  public connectionStatus: ConnectionStatus = "disconnected";
  public state = new GameRoomState();
  public room?: Room<any>;
  private client: Client;

  constructor(options: { endpoint: string }) {
    this.client = new Client(options.endpoint);
  }

  async join(roomName: string, options: any = {}) {
    this.connectionStatus = "connecting";
    try {
      this.room = await this.client.joinOrCreate(roomName, options);
      this.connectionStatus = "connected";

      this.room.onStateChange((serverState) => {
        this.state.sync(serverState);
      });

      this.room.onLeave((code) => {
        this.connectionStatus = "disconnected";
      });

      return this.room;
    } catch (e) {
      this.connectionStatus = "error";
      throw e;
    }
  }

  send(type: string | number, message?: any) {
    if (!this.room) {
      throw new Error("Cannot send message: Not connected to a room.");
    }
    this.room.send(type, message);
  }

  get playerId() {
    return this.room?.sessionId;
  }
}
