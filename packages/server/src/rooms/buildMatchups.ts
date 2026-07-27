import { shuffle } from "../../../../games/wit-clash/src/content/CategoryRepository.js";

export interface PlannedMatchup {
  index: number;
  promptText: string;
  authorIds: string[];
}

export interface PromptLike {
  id: string;
  text: string;
}

export function buildMatchups(
  playerIds: readonly string[],
  prompts: readonly PromptLike[],
  rng: () => number = Math.random,
): PlannedMatchup[] {
  if (playerIds.length === 0 || prompts.length === 0) return [];

  const ring = shuffle(playerIds, rng);
  const pool = shuffle(prompts, rng);
  // biome-ignore lint/style/noNonNullAssertion: Array bounds guaranteed by modulo operation
  const promptAt = (i: number) => pool[i % pool.length]!.text;

  if (ring.length < 3) {
    return [{ index: 0, promptText: promptAt(0), authorIds: [...ring] }];
  }

  return ring.map((id, j) => ({
    index: j,
    promptText: promptAt(j),
    // biome-ignore lint/style/noNonNullAssertion: Array bounds guaranteed by modulo operation
    authorIds: [id, ring[(j + 1) % ring.length]!],
  }));
}
