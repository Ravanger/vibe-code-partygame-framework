import { ArraySchema, Schema, type } from "@colyseus/schema";
import { AnswerSchema } from "./AnswerSchema.js";

export class MatchupSchema extends Schema {
  @type("string") id = "";
  @type("number") index = 0;
  @type("string") promptText = "";
  @type({ array: AnswerSchema }) answers = new ArraySchema<AnswerSchema>();
  @type("boolean") isRevealed = false;

  constructor() {
    super();
    this.answers = new ArraySchema<AnswerSchema>();
  }
}
