export interface ServerGameRoomState {
  phase: string;
  publicData: string;
  roomCode: string;
}

export class GameRoomState {
  phase = "lobby";
  publicData = "{}";
  roomCode = "";

  sync(serverState: ServerGameRoomState) {
    if (serverState.phase !== undefined) {
      this.phase = serverState.phase;
    }
    if (serverState.publicData !== undefined) {
      this.publicData = serverState.publicData;
    }
    if (serverState.roomCode !== undefined) {
      this.roomCode = serverState.roomCode;
    }
  }
}
