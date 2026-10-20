import { required } from "@partygame/core";
import { countVoted, leaders, tallyVotes } from "@partygame/core/kits";
import { ErrorCode } from "@partygame/shared";
import { ACTION, defineAction, VoteHonorSchema } from "../actions.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { Round } from "../round.js";
import type { WitClashState } from "../state.js";

/** The unique authors of the best answers, in order — the candidates. */
const candidatesOf = (state: WitClashState): string[] => {
  const ids: string[] = [];
  for (const answer of state.bestAnswers) {
    if (!ids.includes(answer.authorId)) ids.push(answer.authorId);
  }
  return ids;
};

/** The active players with at least one legal target; a sole candidate has none. */
const voterIds = (ctx: WitClashContext): string[] => {
  const candidates = candidatesOf(ctx.state);
  return ctx
    .activePlayers()
    .map((p) => p.id)
    .filter((id) => candidates.some((c) => c !== id));
};

/** Publishes who may vote and how many ballots are in; the table's pick stays hidden until the end. */
const sync = (ctx: WitClashContext): void => {
  const { state, priv } = ctx;
  const candidates = candidatesOf(state);
  const round = new Round(ctx);
  const active = new Set(ctx.activePlayers().map((p) => p.id));
  for (const player of ctx.players()) {
    if (!active.has(player.id) && !state.mine.has(player.id)) continue;
    round.mineOf(player.id).canVote = candidates.some((c) => c !== player.id);
  }
  const voters = voterIds(ctx);
  state.votesExpected = voters.length;
  state.votesCast = countVoted(voters, priv.honorVotes);
};

/** Tallies the ballots into `honorWinnerNames` (ties share) and moves on to Results. */
const finish = (ctx: WitClashContext): void => {
  const { state, priv } = ctx;
  const tally = tallyVotes(voterIds(ctx), priv.honorVotes);
  state.honorWinnerNames.clear();
  for (const authorId of leaders(tally).ids) {
    state.honorWinnerNames.push(required(priv.names[authorId], "honor winner name"));
  }
  ctx.transition(PHASE.Results);
};

const done = (ctx: WitClashContext): void => {
  if (ctx.state.votesCast >= ctx.state.votesExpected) finish(ctx);
};

/** The optional end-of-game vote: the table picks the funniest of the game's best answers. */
export const HonorVote: WitClashPhase = {
  duration: (ctx) => ctx.options.voteSeconds * 1000,
  onEnter: (ctx) => {
    ctx.priv.honorVotes.clear();
    for (const mine of ctx.state.mine.values()) mine.honorVote = "";
    sync(ctx);
    done(ctx);
  },
  onTimeout: (ctx) => finish(ctx),
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (round.endIfTooFewPlayers()) return;
    round.remember();
    round.pruneDeparted();
    sync(ctx);
    done(ctx);
  },
  actions: {
    [ACTION.VOTE_HONOR]: defineAction({
      from: "player",
      payload: VoteHonorSchema,
      handler: (ctx) => {
        const authorId = ctx.payload.authorId;
        if (!candidatesOf(ctx.state).includes(authorId)) {
          ctx.reject(ErrorCode.INVALID_ACTION, "That answer is not up for the honor vote");
          return;
        }
        if (authorId === ctx.playerId) {
          ctx.reject(ErrorCode.NOT_ALLOWED, "You cannot vote for your own answer");
          return;
        }
        ctx.priv.honorVotes.set(ctx.playerId, authorId);
        new Round(ctx).mineOf(ctx.playerId).honorVote = authorId;
        sync(ctx);
        done(ctx);
      },
    }),
  },
};
