import { createPhase, defineGame } from "@partygame/core";

export interface WitClashState {
  scores: Record<string, number>;
  prompts: Record<string, string>;
  votes: Record<string, number>;
  category: string;
  phase: string;
}

export const WitClashGame = defineGame<WitClashState>({
  name: "WitClash",
  minPlayers: 3,
  maxPlayers: 8,
  initialState: () => ({
    scores: {},
    prompts: {},
    votes: {},
    category: "",
    phase: "Lobby",
  }),
  phases: {
    Lobby: createPhase({
      actions: {
        START_GAME: {
          from: "player", // Host check happens at the framework level usually, or here
          handler: (ctx) => {
            ctx.state.phase = "CategorySelection";
          },
        },
      },
    }),
    CategorySelection: createPhase({
      actions: {
        SELECT_CATEGORY: {
          from: "player",
          handler: (ctx) => {
            ctx.state.category = (ctx.data as any).category;
            ctx.state.phase = "Prompting";
          },
        },
      },
    }),
    Prompting: createPhase({
      actions: {
        SUBMIT_ANSWER: {
          from: "player",
          handler: (ctx) => {
            ctx.state.prompts[ctx.clientId] = (ctx.data as any).text;
            // Transition logic would be in the framework/machine, but we'll mock it here
          },
        },
      },
    }),
    Voting: createPhase({
      actions: {
        VOTE: {
          from: "player",
          handler: (ctx) => {
            const answerId = (ctx.data as any).answerId;
            ctx.state.votes[answerId] = (ctx.state.votes[answerId] || 0) + 1;
          },
        },
      },
    }),
    Results: createPhase({
      actions: {
        PLAY_AGAIN: {
          from: "player",
          handler: (ctx) => {
            ctx.state.phase = "Lobby";
            ctx.state.prompts = {};
            ctx.state.votes = {};
          },
        },
      },
    }),
  },
});
