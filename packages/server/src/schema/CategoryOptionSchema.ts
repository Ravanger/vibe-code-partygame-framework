import { Schema, type } from "@colyseus/schema";

export class CategoryOptionSchema extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") emoji = "";
  @type("number") votes = 0;
}
