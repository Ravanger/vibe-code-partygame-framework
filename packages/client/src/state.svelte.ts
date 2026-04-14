export class GameRoomState {
  count = $state(0);

  sync(serverState: any) {
    if (serverState.count !== undefined) {
      this.count = serverState.count;
    }
  }
}
