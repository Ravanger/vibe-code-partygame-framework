import { ArraySchema, MapSchema, Schema, defineTypes } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  phase = "lobby";
  publicData = "{}";
  roomCode = "";
  currentVotingOptions = new ArraySchema<string>();
  selectedCategory = "";
  players = new MapSchema<PlayerSchema>();
}

defineTypes(GameStateSchema, {
  phase: "string",
  publicData: "string",
  roomCode: "string",
  currentVotingOptions: ["string"],
  selectedCategory: "string",
  players: { map: PlayerSchema }
});
