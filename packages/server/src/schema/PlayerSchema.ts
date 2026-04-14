import { Schema, type } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") role: string = "player";
}
