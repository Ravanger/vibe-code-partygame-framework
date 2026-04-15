import { Schema, type, defineTypes } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  id = "";
  name = "";
  role = "player";
}
defineTypes(PlayerSchema, {
  id: "string",
  name: "string",
  role: "string"
});
