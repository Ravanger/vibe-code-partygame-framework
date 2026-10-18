/** One author's slot in a matchup; `text` is undefined when they never answered. */
export interface AuthoredDraft {
  playerId: string;
  text: string | undefined;
}

export type MatchupKind = "contested" | "forfeit" | "skipped";

/** Two real answers are contested; exactly one wins by forfeit; none is not worth showing. */
export function classifyMatchup(entries: readonly AuthoredDraft[]): MatchupKind {
  const real = entries.filter((e) => e.text !== undefined).length;
  if (real === 0) return "skipped";
  return real === 1 ? "forfeit" : "contested";
}
