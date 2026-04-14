import { Schema, type } from "@colyseus/schema";

export class GameStateSchema extends Schema {
  @type("string") phase: string = "lobby";
  @type("string") publicData: string = "{}";
  @type("string") roomCode: string = "";
}
