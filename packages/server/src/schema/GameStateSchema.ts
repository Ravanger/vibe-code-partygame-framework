import { Schema, type, MapSchema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  @type("string") phase: string = "lobby";
  @type("string") publicData: string = "{}";
  @type("string") roomCode: string = "";
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}
