import { Room } from "colyseus";
import { Schema, type } from "@colyseus/schema";

class GameState extends Schema {
  @type("string") status: string = "lobby";
}

export class GameRoom extends Room<GameState> {
  onCreate() {
    this.setState(new GameState());
  }
}
