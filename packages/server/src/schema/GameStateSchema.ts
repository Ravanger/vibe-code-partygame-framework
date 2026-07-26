import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { CategoryOptionSchema } from "./CategoryOptionSchema.js";
import { MatchupSchema } from "./MatchupSchema.js";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  @type("string") phase = "Lobby";
  @type("string") publicData = "{}";
  @type("string") roomCode = "";
  @type({ array: "string" }) currentVotingOptions: ArraySchema<string>;
  @type("string") selectedCategory = "";
  @type({ map: PlayerSchema }) players: MapSchema<PlayerSchema>;
  @type({ array: CategoryOptionSchema })
  categoryOptions: ArraySchema<CategoryOptionSchema>;
  @type({ map: "string" }) categoryVotes: MapSchema<string>;
  @type("number") phaseEndsAt = 0;
  @type("number") serverNow = 0;
  @type("string") promptId = "";
  @type("string") promptText = "";
  @type({ map: "string" }) submittedAnswers: MapSchema<string>;
  @type({ array: MatchupSchema }) matchups: ArraySchema<MatchupSchema>;
  @type({ map: "string" }) playerVotes: MapSchema<string>;
  @type({ map: "number" }) scores: MapSchema<number>;
  @type("number") round = 1;
  @type("number") maxRounds = 5;

  constructor() {
    super();
    this.currentVotingOptions = new ArraySchema<string>();
    this.players = new MapSchema<PlayerSchema>();
    this.categoryOptions = new ArraySchema<CategoryOptionSchema>();
    this.categoryVotes = new MapSchema<string>();
    this.submittedAnswers = new MapSchema<string>();
    this.matchups = new ArraySchema<MatchupSchema>();
    this.playerVotes = new MapSchema<string>();
    this.scores = new MapSchema<number>();
  }
}
