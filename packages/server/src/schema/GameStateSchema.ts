import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { CategoryOptionSchema } from "./CategoryOptionSchema.js";
import { MatchupSchema } from "./MatchupSchema.js";
import { PlayerSchema } from "./PlayerSchema.js";

export class GameStateSchema extends Schema {
  @type("string") phase = "Lobby";
  @type("string") publicData = "{}";
  @type("string") roomCode = "";
  @type({ map: PlayerSchema }) players: MapSchema<PlayerSchema>;
  @type({ array: CategoryOptionSchema })
  categoryOptions: ArraySchema<CategoryOptionSchema>;
  @type({ map: "string" }) categoryVotes: MapSchema<string>;
  @type("number") phaseEndsAt = 0;
  @type("number") serverNow = 0;
  @type("string") selectedCategory = "";
  @type({ array: MatchupSchema }) matchups: ArraySchema<MatchupSchema>;
  @type("number") roundNumber = 0;
  @type("number") totalRounds = 3;
  @type("number") answersSubmitted = 0;
  @type("number") answersExpected = 0;
  @type({ map: "number" }) scores: MapSchema<number>;
  @type("number") activeMatchupIndex = -1;
  @type("boolean") isRevealing = false;
  @type({ map: "string" }) answerVotes: MapSchema<string>;

  constructor() {
    super();
    this.players = new MapSchema<PlayerSchema>();
    this.categoryOptions = new ArraySchema<CategoryOptionSchema>();
    this.categoryVotes = new MapSchema<string>();
    this.matchups = new ArraySchema<MatchupSchema>();
    this.scores = new MapSchema<number>();
    this.answerVotes = new MapSchema<string>();
  }
}
