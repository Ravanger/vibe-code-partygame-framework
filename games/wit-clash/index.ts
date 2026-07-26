import { createPhase, defineGame } from "@partygame/core";

export interface WitClashState {
  scores: Record<string, number>;
  prompts: Record<string, string>;
  votes: Record<string, number>;
  category: string;
  phase: string;
}

interface VoteCategoryPayload {
  categoryId: string;
}

interface SubmitAnswerPayload {
  answer: string;
}

interface VotePayload {
  answerId: string;
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
          from: "host",
          handler: (ctx) => {
            ctx.state.phase = "CategorySelection";
          },
        },
      },
    }),
    CategorySelection: createPhase({
      actions: {
        VOTE_CATEGORY: {
          from: "player",
          handler: (ctx: { state: WitClashState; data: VoteCategoryPayload }) => {
            ctx.state.category = ctx.data.categoryId;
            ctx.state.phase = "Prompting";
          },
        },
      },
    }),
    Prompting: createPhase({
      actions: {
        SUBMIT_ANSWER: {
          from: "player",
          handler: (ctx: { state: WitClashState; clientId: string; data: SubmitAnswerPayload }) => {
            ctx.state.prompts[ctx.clientId] = ctx.data.answer;
          },
        },
        RESOLVE_PROMPTING: {
          from: "host",
          handler: (ctx) => {
            ctx.state.phase = "Voting";
          },
        },
      },
    }),
    Voting: createPhase({
      actions: {
        CAST_VOTE: {
          from: "player",
          handler: (ctx: { state: WitClashState; data: VotePayload }) => {
            const answerId = ctx.data.answerId;
            ctx.state.votes[answerId] = (ctx.state.votes[answerId] || 0) + 1;
          },
        },
        RESOLVE_VOTING: {
          from: "host",
          handler: (ctx) => {
            ctx.state.phase = "Results";
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
        NEXT_ROUND: {
          from: "host",
          handler: (ctx) => {
            ctx.state.phase = "CategorySelection";
            ctx.state.prompts = {};
            ctx.state.votes = {};
          },
        },
      },
    }),
  },
});
