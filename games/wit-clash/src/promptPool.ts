import type { Prompt } from "./content/CategoryRepository.js";

export interface PromptPool {
  prompts: readonly Prompt[];
  /** True when the category could not supply `needed` unused prompts, so its used set must be cleared. */
  exhausted: boolean;
}

/** The prompts of a category not yet used this game, or all of them when too few are left. */
export function pickPromptPool(
  prompts: readonly Prompt[],
  usedIds: ReadonlySet<string>,
  needed: number,
): PromptPool {
  const fresh = prompts.filter((p) => !usedIds.has(p.id));
  return fresh.length >= needed
    ? { prompts: fresh, exhausted: false }
    : { prompts, exhausted: true };
}
