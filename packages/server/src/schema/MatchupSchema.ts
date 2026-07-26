import { Schema, type } from "@colyseus/schema";

export class MatchupSchema extends Schema {
  @type("string") id = "";
  @type("string") answerAId = "";
  @type("string") answerA = "";
  @type("string") answerBId = "";
  @type("string") answerB = "";
  @type("number") votesA = 0;
  @type("number") votesB = 0;
}
