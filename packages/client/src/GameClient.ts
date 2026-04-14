import { ConnectionStatus } from "./types.js";

export class GameClient {
  public connectionStatus: ConnectionStatus = 'connecting';
  private roomCode: string;
  
  constructor(options: { roomCode: string }) {
    this.roomCode = options.roomCode;
  }
}
