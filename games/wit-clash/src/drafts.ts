export type Assignments = ReadonlyMap<string, readonly string[]>;
export type Drafts = ReadonlyMap<string, ReadonlyMap<string, string>>;

/** One author's slot in a matchup; `text` is undefined when they never answered. */
export interface AuthoredDraft {
  playerId: string;
  text: string | undefined;
}

export type MatchupKind = "contested" | "forfeit" | "skipped";

/** Every assigned prompt of every present author has an answer; absent authors are not waited for. */
export function allAnswered(
  assignments: Assignments,
  drafts: Drafts,
  presentIds: ReadonlySet<string>,
): boolean {
  const waitingOn = [...assignments].filter(([playerId]) => presentIds.has(playerId));
  return (
    waitingOn.length > 0 &&
    waitingOn.every(([playerId, ids]) => ids.every((id) => drafts.get(playerId)?.has(id)))
  );
}

export function draftsFor(
  matchupId: string,
  assignments: Assignments,
  drafts: Drafts,
): AuthoredDraft[] {
  return [...assignments]
    .filter(([, ids]) => ids.includes(matchupId))
    .map(([playerId]) => ({ playerId, text: drafts.get(playerId)?.get(matchupId) }));
}

/** Two real answers are contested; exactly one wins by forfeit; none is not worth showing. */
export function classifyMatchup(entries: readonly AuthoredDraft[]): MatchupKind {
  const real = entries.filter((e) => e.text !== undefined).length;
  if (real === 0) return "skipped";
  return real === 1 ? "forfeit" : "contested";
}
