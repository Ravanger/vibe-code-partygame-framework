import { required } from "@partygame/core";
import type { AnswerRecord } from "./bestAnswers.js";

type HighlightKind = "biggestMargin" | "closestMatch" | "fastestAnswer";

/** One highlight card: a matchup's prompt and its answers. The margin and closest cards show the
 * whole contest; the fastest card shows only the tied fastest answer(s). */
interface Highlight {
  kind: HighlightKind;
  promptText: string;
  answers: { authorName: string; text: string; votes: number }[];
}

/** The three highlights of a game, each present when the history supports it. Ties share: every
 * tied matchup (or answer) gets its own card, in the order the matchups first appear. */
export interface PickedHighlights {
  biggestMargin?: Highlight[];
  closestMatch?: Highlight[];
  fastestAnswer?: Highlight[];
}

/** Winner's votes minus the best opposing answer of the same matchup (0 for a level contest).
 * The game writes exactly two records per matchup, so both lookups are present. */
const gapOf = (records: readonly AnswerRecord[]): number => {
  const votes = records.map((r) => r.votes).sort((a, b) => b - a);
  return required(votes[0], "top vote") - required(votes[1], "second vote");
};

/** A matchup is contestable when every answer was actually submitted (no placeholders) and at
 * least one vote was cast. Forfeited matchups never reach the history at all. */
const contestable = (records: readonly AnswerRecord[]): boolean =>
  records.every((r) => r.answerMs !== undefined) && records.some((r) => r.votes > 0);

const card = (
  kind: HighlightKind,
  promptText: string,
  answers: readonly AnswerRecord[],
): Highlight => ({
  kind,
  promptText,
  answers: answers.map((r) => ({ authorName: r.authorName, text: r.text, votes: r.votes })),
});

export function pickHighlights(records: readonly AnswerRecord[]): PickedHighlights {
  const contests: AnswerRecord[][] = [];
  const byMatchup = new Map<string, AnswerRecord[]>();
  for (const record of records) {
    const group = byMatchup.get(record.matchupId);
    if (group === undefined) {
      byMatchup.set(record.matchupId, [record]);
      continue;
    }
    group.push(record);
  }
  for (const group of byMatchup.values()) {
    if (contestable(group)) contests.push(group);
  }

  const picked: PickedHighlights = {};

  const biggest = contests.length > 0 ? Math.max(...contests.map(gapOf)) : 0;
  if (biggest > 0) {
    picked.biggestMargin = contests
      .filter((g) => gapOf(g) === biggest)
      .map((g) => card("biggestMargin", required(g[0], "contest").promptText, g));
  }

  if (contests.length > 0) {
    const closest = Math.min(...contests.map(gapOf));
    picked.closestMatch = contests
      .filter((g) => gapOf(g) === closest)
      .map((g) => card("closestMatch", required(g[0], "contest").promptText, g));
  }

  const voted = records.filter(
    (r): r is AnswerRecord & { answerMs: number } => r.votes > 0 && r.answerMs !== undefined,
  );
  if (voted.length > 0) {
    const fastest = Math.min(...voted.map((r) => r.answerMs));
    const tiedByMatchup = new Map<string, AnswerRecord[]>();
    for (const record of voted) {
      if (record.answerMs !== fastest) continue;
      const group = tiedByMatchup.get(record.matchupId);
      if (group === undefined) tiedByMatchup.set(record.matchupId, [record]);
      else group.push(record);
    }
    picked.fastestAnswer = [...tiedByMatchup.values()].map((g) =>
      card("fastestAnswer", required(g[0], "tied answers").promptText, g),
    );
  }

  return picked;
}
