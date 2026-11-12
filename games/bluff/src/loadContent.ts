import { contentDirFrom } from "@partygame/content";
import { loadPrompts, type PromptRepository } from "./content/PromptRepository.js";

export const MIN_PROMPTS = 6;

/** `BLUFF_CONTENT_DIR`, or `content/prompts` next to `entryUrl` (the entry file's `import.meta.url`). */
export function contentDir(env: Record<string, string | undefined>, entryUrl: string): string {
  return contentDirFrom(env.BLUFF_CONTENT_DIR, entryUrl, "./content/prompts");
}

/** Loads the prompt pack files from the directory and refuses to start with fewer than {@link MIN_PROMPTS}. */
export async function loadContent(dir: string): Promise<PromptRepository> {
  const prompts = await loadPrompts(dir);
  const count = prompts.all().length;
  if (count < MIN_PROMPTS) {
    throw new Error(`Need at least ${MIN_PROMPTS} prompts in ${dir}, found ${count}`);
  }
  return prompts;
}
