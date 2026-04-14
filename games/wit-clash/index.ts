import { defineGame, createPhase } from "@partygame/core";
import { PromptPhase } from "@partygame/core";
import { VotePhase } from "@partygame/core";

const promptPhase = new PromptPhase();
const votePhase = new VotePhase();

export const WitClashGame = defineGame({
  name: "WitClash",
  minPlayers: 3,
  maxPlayers: 8,
  initialState: () => ({
    scores: {},
    prompts: {},
    votes: {},
  }),
  phases: {
    prompting: createPhase({
      actions: {
        SubmitAnswer: {
          from: "player",
          handler: (ctx) => {
            promptPhase.handleAction(ctx.clientId, ctx.data as any);
          }
        }
      }
    }),
    voting: createPhase({
      actions: {
        CastVote: {
          from: "player",
          handler: (ctx) => {
            votePhase.handleAction(ctx.clientId, ctx.data as any);
          }
        }
      }
    })
  },
  visibility: {
    // Visibility rules go here
  }
});
