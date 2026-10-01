export interface AnswerRecord {
  text: string;
  authorId: string;
  authorName: string;
  promptText: string;
  votes: number;
  matchupVotes: number;
}

const compare = (a: AnswerRecord, b: AnswerRecord): number =>
  b.votes * a.matchupVotes - a.votes * b.matchupVotes || b.votes - a.votes;

/** Highest vote share within a matchup, then most votes; answers equal on both share the award. */
export function pickBestAnswers(records: readonly AnswerRecord[]): AnswerRecord[] {
  const sorted = records.filter((r) => r.votes > 0).sort(compare);
  const [first] = sorted;
  return first ? sorted.filter((r) => compare(first, r) === 0) : [];
}
