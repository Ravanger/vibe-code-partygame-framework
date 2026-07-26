import { Schema, type } from "@colyseus/schema";

export class AnswerSchema extends Schema {
  @type("string") id = "";
  @type("string") text = "";
  @type("number") votes = 0;
  @type("string") authorId = "";
}
