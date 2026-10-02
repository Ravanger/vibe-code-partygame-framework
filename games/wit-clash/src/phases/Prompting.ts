import { required, shuffle } from "@partygame/core";
import { classifyMatchup, draftsFor } from "../drafts.js";
import { buildMatchups } from "../matchups.js";
import { PHASE } from "../phaseNames.js";
import type { WitClashContext, WitClashPhase } from "../private.js";
import { pickPromptPool } from "../promptPool.js";
import { PLACEHOLDER_TEXT, Round } from "../round.js";
import { Answer, Matchup, PromptAssignment } from "../state.js";
import { TieBreakerFlow } from "../tieBreakerFlow.js";
import { answeringActions, answersComplete } from "./answering.js";

const finish = (ctx: WitClashContext): void => {
  const { state, priv } = ctx;
  const skipped: number[] = [];
  state.matchups.forEach((matchup, index) => {
    const entries = draftsFor(matchup.id, priv.assignments, priv.drafts);
    const answers = entries.map((entry) => {
      const answer = new Answer();
      answer.id = crypto.randomUUID();
      answer.text = entry.text ?? PLACEHOLDER_TEXT;
      priv.authors.set(answer.id, entry.playerId);
      if (entry.text === undefined) priv.placeholders.add(answer.id);
      return answer;
    });
    for (const answer of shuffle(answers, ctx.rng)) matchup.answers.push(answer);
    const kind = classifyMatchup(entries);
    matchup.isForfeit = kind === "forfeit";
    if (kind === "skipped") skipped.push(index);
  });
  for (const index of skipped.reverse()) state.matchups.splice(index, 1);
  state.matchups.forEach((matchup, index) => {
    matchup.index = index;
  });
  state.activeMatchupIndex = -1;
  new Round(ctx).clearTyping();
  if (state.matchups.length > 0) ctx.transition(PHASE.MatchupVoting);
  else new TieBreakerFlow(ctx).afterMatchups();
};

const deal = (ctx: WitClashContext): void => {
  const { state, priv } = ctx;
  const round = new Round(ctx);
  round.remember();
  const players = ctx.activePlayers();
  const category = required(priv.content.byId(priv.categoryId), "selected category");
  const { prompts, exhausted } = pickPromptPool(
    category.prompts,
    priv.usedPromptIds,
    Math.max(players.length, 1),
  );
  if (exhausted) for (const prompt of category.prompts) priv.usedPromptIds.delete(prompt.id);
  const planned = buildMatchups(
    players.map((p) => p.id),
    prompts,
    ctx.rng,
  );
  const promptTexts = new Map<string, string>();
  for (const plan of planned) {
    const matchup = new Matchup();
    matchup.id = crypto.randomUUID();
    matchup.index = plan.index;
    matchup.promptText = plan.promptText;
    promptTexts.set(matchup.id, plan.promptText);
    state.matchups.push(matchup);
    priv.usedPromptIds.add(plan.promptId);
    for (const authorId of plan.authorIds) {
      priv.assignments.set(authorId, [...(priv.assignments.get(authorId) ?? []), matchup.id]);
    }
  }
  for (const player of players) {
    const matchupIds = required(priv.assignments.get(player.id), "assignments");
    state.progress.set(player.id, 0);
    state.answersPerPlayer = Math.max(state.answersPerPlayer, matchupIds.length);
    const mine = round.mineOf(player.id);
    for (const matchupId of matchupIds) {
      const assignment = new PromptAssignment();
      assignment.matchupId = matchupId;
      assignment.promptText = required(promptTexts.get(matchupId), "prompt text");
      mine.prompts.push(assignment);
    }
  }
  if (planned.length === 0) ctx.transition(PHASE.Results);
};

export const Prompting: WitClashPhase = {
  duration: (ctx) => ctx.options.promptSeconds * 1000,
  onEnter: deal,
  onTimeout: finish,
  onRosterChange: (ctx) => {
    const round = new Round(ctx);
    if (round.endIfTooFewPlayers()) return;
    round.remember();
    for (const playerId of [...ctx.priv.assignments.keys()]) {
      if (ctx.player(playerId)) continue;
      ctx.priv.assignments.delete(playerId);
      ctx.priv.drafts.delete(playerId);
    }
    round.pruneDeparted();
    if (answersComplete(ctx)) finish(ctx);
  },
  actions: answeringActions(finish),
};
