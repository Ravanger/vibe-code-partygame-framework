import { Room } from "colyseus";
import { GameStateSchema } from "../schema/GameStateSchema.js";

export class GameRoom extends Room<GameStateSchema> {
  onCreate() {
    this.setState(new GameStateSchema());
  }
}
