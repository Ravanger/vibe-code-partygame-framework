import { eligibleVoters, leaders } from "@partygame/core/kits";
import type { Category, Prompt } from "./content/CategoryRepository.js";

export interface TieBreakerPlan {
  contenderIds: string[];
  prompt: Prompt;
}

export interface TieBreakerResult {
  winnerId: string | undefined;
  /** Authors still level at the top; empty when nobody answered. */
  leaderIds: string[];
}

/** Players sharing the highest score. */
export function topScorers(
  scores: Readonly<Record<string, number>>,
  candidateIds: readonly string[],
): string[] {
  const counts = new Map(candidateIds.map((id): [string, number] => [id, scores[id] ?? 0]));
  return leaders(counts).ids;
}

/** An unused tie-breaker of the last category if there is one, otherwise of any other category. */
export function pickTieBreakerPrompt(
  categories: readonly Category[],
  preferredId: string,
  usedIds: ReadonlySet<string>,
  rng: () => number,
): Prompt | undefined {
  const unused = (category: Category): Prompt[] =>
    category.tieBreakers.filter((p) => !usedIds.has(p.id));
  const preferred = categories.filter((c) => c.id === preferredId).flatMap(unused);
  const pool =
    preferred.length > 0
      ? preferred
      : categories.filter((c) => c.id !== preferredId).flatMap(unused);
  return pool[Math.floor(rng() * pool.length)];
}

/** Who may vote: everyone active outside the tie. */
export function tieBreakerVoterIds(
  activeIds: readonly string[],
  contenderIds: readonly string[],
): string[] {
  return eligibleVoters(activeIds, contenderIds);
}

/** A lone answer wins by default; otherwise the single top vote-getter, or the authors still level. */
export function resolveTieBreaker(
  answers: ReadonlyArray<{ authorId: string; votes: number }>,
): TieBreakerResult {
  const { ids } = leaders(new Map(answers.map((a): [string, number] => [a.authorId, a.votes])));
  return { winnerId: ids.length === 1 ? ids[0] : undefined, leaderIds: ids };
}

export const TIE_BREAKER_BONUS = 1;
