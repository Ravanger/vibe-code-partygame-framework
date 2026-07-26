import { Schema, type } from "@colyseus/schema";

export class ScoreEntrySchema extends Schema {
  @type("string") playerId = "";
  @type("string") name = "";
  @type("number") score = 0;
  @type("number") roundPoints = 0;
  @type("number") matchupsWon = 0;
  @type("boolean") hadClash = false;
}
