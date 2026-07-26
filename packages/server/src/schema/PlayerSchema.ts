import { Schema, type } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") id = "";
  @type("string") playerId = "";
  @type("string") name = "";
  @type("string") role = "player";
  @type("boolean") isReady = false;
  @type("boolean") isConnected = true;
}
