import { ArraySchema, defineTypes, MapSchema, Schema } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  phase = "lobby";
  publicData = "{}";
  roomCode = "";
  currentVotingOptions: ArraySchema<string>;
  selectedCategory = "";
  players: MapSchema<PlayerSchema>;

  constructor() {
    super();
    this.currentVotingOptions = new ArraySchema<string>();
    this.players = new MapSchema<PlayerSchema>();
  }
}

defineTypes(GameStateSchema, {
  phase: "string",
  publicData: "string",
  roomCode: "string",
  currentVotingOptions: ["string"],
  selectedCategory: "string",
  players: { map: PlayerSchema },
});
