import { required } from "./required.js";
import { shuffle } from "./shuffle.js";

export interface PlannedMatchup {
  index: number;
  promptId: string;
  promptText: string;
  authorIds: string[];
}

export interface PromptLike {
  id: string;
  text: string;
}

/** Ring pairing: with 3+ players everyone writes two answers and every answer pairs with a neighbour's. */
export function buildMatchups(
  playerIds: readonly string[],
  prompts: readonly PromptLike[],
  rng: () => number = Math.random,
): PlannedMatchup[] {
  if (playerIds.length === 0 || prompts.length === 0) return [];

  const ring = shuffle(playerIds, rng);
  const pool = shuffle(prompts, rng);
  const promptAt = (i: number): PromptLike => required(pool[i % pool.length], "prompt");
  const plan = (index: number, authorIds: string[]): PlannedMatchup => ({
    index,
    promptId: promptAt(index).id,
    promptText: promptAt(index).text,
    authorIds,
  });

  if (ring.length < 3) return [plan(0, [...ring])];
  return ring.map((id, j) =>
    plan(j, [id, required(ring[(j + 1) % ring.length], "ring neighbour")]),
  );
}
