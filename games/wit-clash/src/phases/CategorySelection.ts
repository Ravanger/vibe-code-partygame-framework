import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, VoteCategorySchema } from "../actions.js";
import { resolveCategoryVote } from "../categoryVote.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import { CategoryOption } from "../state.js";
import { allHaveVoted, countVoted, tallyVotes } from "../tally.js";
import { endGameActions } from "./endGame.js";

const OPTION_COUNT = 3;

const everyoneVoted = (ctx: WitClashContext): boolean =>
  allHaveVoted(
    ctx.activePlayers().map((p) => p.id),
    ctx.priv.categoryVotes,
  );

const recount = (ctx: WitClashContext): void => {
  const tally = tallyVotes(
    ctx.activePlayers().map((p) => p.id),
    ctx.priv.categoryVotes,
  );
  for (const option of ctx.state.categoryOptions) option.votes = tally.get(option.id) ?? 0;
};

const publishProgress = (ctx: WitClashContext): void => {
  const ids = ctx.activePlayers().map((p) => p.id);
  ctx.state.votesExpected = ids.length;
  ctx.state.votesCast = countVoted(ids, ctx.priv.categoryVotes);
};

const resolve = (ctx: WitClashContext): void => {
  const options = [...ctx.state.categoryOptions].map((o) => ({ id: o.id, votes: o.votes }));
  const winner = resolveCategoryVote(options, ctx.rng);
  ctx.priv.categoryId = winner;
  ctx.state.selectedCategory = winner;
  ctx.transition(PHASE.Prompting);
};

export const CategorySelection: WitClashPhase = {
  duration: (ctx) => ctx.options.categoryVoteSeconds * 1000,
  onEnter: (ctx) => {
    ctx.state.notice = "";
    ctx.activateWaitingPlayers();
    const { state } = ctx;
    const round = new Round(ctx);
    if (round.endIfTooFewPlayers()) return;
    round.clearRound();
    round.remember();
    ++state.roundNumber;
    state.totalRounds = ctx.options.totalRounds;
    for (const category of ctx.priv.content.pickRandom(OPTION_COUNT, ctx.rng)) {
      const option = new CategoryOption();
      option.id = category.id;
      option.name = category.name;
      option.emoji = category.emoji;
      state.categoryOptions.push(option);
    }
    for (const player of ctx.activePlayers()) round.mineOf(player.id);
    publishProgress(ctx);
  },
  onTimeout: resolve,
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (round.endIfTooFewPlayers()) return;
    round.remember();
    round.pruneDeparted();
    recount(ctx);
    publishProgress(ctx);
    if (everyoneVoted(ctx)) resolve(ctx);
  },
  actions: {
    ...endGameActions,
    [ACTION.VOTE_CATEGORY]: defineAction({
      from: "player",
      payload: VoteCategorySchema,
      handler: (ctx) => {
        const { categoryId } = ctx.payload;
        if (!ctx.state.categoryOptions.some((o) => o.id === categoryId)) {
          ctx.reject(ErrorCode.INVALID_ACTION, "Unknown category");
          return;
        }
        if (!ctx.player(ctx.playerId)?.isReady) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "Choose a name first");
          return;
        }
        ctx.priv.categoryVotes.set(ctx.playerId, categoryId);
        new Round(ctx).mineOf(ctx.playerId).categoryVote = categoryId;
        recount(ctx);
        publishProgress(ctx);
        if (everyoneVoted(ctx)) resolve(ctx);
      },
    }),
  },
};
