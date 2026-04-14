import { defineGame, createPhase } from "@partygame/core";
import { PromptPhase } from "@partygame/core";
import { VotePhase } from "@partygame/core";

export const WitClashGame = defineGame({
  name: "WitClash",
  minPlayers: 3,
  maxPlayers: 8,
  initialState: () => ({
    scores: {},
    prompts: {},
  }),
  phases: {
    prompting: createPhase({
      actions: {
        SubmitAnswer: {
          from: "player",
          handler: (ctx) => {
            // Implementation for prompt phase
          }
        }
      }
    }),
    voting: createPhase({
      actions: {
        CastVote: {
          from: "player",
          handler: (ctx) => {
            // Implementation for voting phase
          }
        }
      }
    })
  },
  visibility: {
    // Visibility rules go here
  }
});
