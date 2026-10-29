export interface AnswerRecord {
  text: string;
  authorId: string;
  authorName: string;
  promptText: string;
  votes: number;
  matchupVotes: number;
  /** The matchup the answer belongs to; groups the history for per-matchup highlights. */
  matchupId: string;
  /** Ms after the answering phase started that the author submitted. Placeholders never reach the
   * history (their matchups forfeit or skip), so records written by the game always carry a time;
   * `undefined` is the defensive contract `pickHighlights` checks for answers never submitted. */
  answerMs?: number | undefined;
}

const compare = (a: AnswerRecord, b: AnswerRecord): number =>
  b.votes * a.matchupVotes - a.votes * b.matchupVotes || b.votes - a.votes;

/** Highest vote share within a matchup, then most votes; answers equal on both share the award. */
export function pickBestAnswers(records: readonly AnswerRecord[]): AnswerRecord[] {
  const sorted = records.filter((r) => r.votes > 0).sort(compare);
  const [first] = sorted;
  return first ? sorted.filter((r) => compare(first, r) === 0) : [];
}
