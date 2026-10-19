import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrompts, type PromptRepository } from "./content/PromptRepository.js";

export const MIN_PROMPTS = 6;

/** `BLUFF_CONTENT_DIR`, or `content` next to `entryUrl` (the entry file's `import.meta.url`). */
export function contentDir(env: Record<string, string | undefined>, entryUrl: string): string {
  return env.BLUFF_CONTENT_DIR ?? fileURLToPath(new URL("./content", entryUrl));
}

/** Loads `prompts.jsonc` from the content dir and refuses to start with fewer than {@link MIN_PROMPTS}. */
export async function loadContent(dir: string): Promise<PromptRepository> {
  const file = join(dir, "prompts.jsonc");
  const prompts = await loadPrompts(file);
  const count = prompts.all().length;
  if (count < MIN_PROMPTS) {
    throw new Error(`Need at least ${MIN_PROMPTS} prompts in ${file}, found ${count}`);
  }
  return prompts;
}
