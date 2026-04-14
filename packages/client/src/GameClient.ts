import { GameRoomState } from './state.svelte.js';
import type { ConnectionStatus } from './types.js';

export class GameClient {
  public connectionStatus: ConnectionStatus = 'connecting';
  public state = new GameRoomState();
  private roomCode: string;

  constructor(options: { roomCode: string }) {
    this.roomCode = options.roomCode;
  }

  // Hook for Colyseus room
  onStateChange(serverState: any) {
    this.state.sync(serverState);
  }
}
