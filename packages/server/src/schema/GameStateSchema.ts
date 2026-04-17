import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  @type("string") phase = "Lobby";
  @type("string") publicData = "{}";
  @type("string") roomCode = "";
  @type({ array: "string" }) currentVotingOptions: ArraySchema<string>;
  @type("string") selectedCategory = "";
  @type({ map: PlayerSchema }) players: MapSchema<PlayerSchema>;

  constructor() {
    super();
    this.currentVotingOptions = new ArraySchema<string>();
    this.players = new MapSchema<PlayerSchema>();
  }
}
