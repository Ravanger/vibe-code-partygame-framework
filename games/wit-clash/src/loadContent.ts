import { fileURLToPath } from "node:url";
import { type CategoryRepository, loadCategoriesFromDir } from "./content/CategoryRepository.js";

export const MIN_CATEGORIES = 3;

/** `WITCLASH_CONTENT_DIR`, or `content/categories` next to `entryUrl` (the entry file's `import.meta.url`). */
export function contentDir(env: Record<string, string | undefined>, entryUrl: string): string {
  return env.WITCLASH_CONTENT_DIR ?? fileURLToPath(new URL("./content/categories", entryUrl));
}

/** Loads the category files and refuses to start with fewer than {@link MIN_CATEGORIES}. */
export async function loadContent(dir: string): Promise<CategoryRepository> {
  const categories = await loadCategoriesFromDir(dir);
  const count = categories.all().length;
  if (count < MIN_CATEGORIES) {
    throw new Error(`Need at least ${MIN_CATEGORIES} categories in ${dir}, found ${count}`);
  }
  return categories;
}

/** The canon: the category files shipped in the repo next to `entryUrl`, always. Daily mode must
 * not see a host's `WITCLASH_CONTENT_DIR`. */
export async function loadCanonContent(entryUrl: string): Promise<CategoryRepository> {
  return loadContent(fileURLToPath(new URL("./content/categories", entryUrl)));
}
