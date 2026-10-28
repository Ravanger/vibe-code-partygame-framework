import { fileURLToPath } from "node:url";
import { type CategoryRepository, loadCategoriesFromDir } from "./content/CategoryRepository.js";

export const MIN_CATEGORIES = 3;

/** `WITCLASH_CONTENT_DIR`, or `content/categories` next to `entryUrl` (the entry file's `import.meta.url`). */
export function contentDir(env: Record<string, string | undefined>, entryUrl: string): string {
  return env.WITCLASH_CONTENT_DIR ?? fileURLToPath(new URL("./content/categories", entryUrl));
}

/**
 * Loads the category files and refuses to start with fewer than {@link MIN_CATEGORIES} total, or
 * fewer than {@link MIN_CATEGORIES} family-rated (a room set to `contentRating: "family"` would
 * have no content to play).
 */
export async function loadContent(dir: string): Promise<CategoryRepository> {
  const categories = await loadCategoriesFromDir(dir);
  const all = categories.all();
  if (all.length < MIN_CATEGORIES) {
    throw new Error(`Need at least ${MIN_CATEGORIES} categories in ${dir}, found ${all.length}`);
  }
  const family = all.filter((c) => c.rating === "family").length;
  if (family < MIN_CATEGORIES) {
    throw new Error(
      `Need at least ${MIN_CATEGORIES} family-rated categories in ${dir}, found ${family}`,
    );
  }
  return categories;
}

/** The canon: the category files shipped in the repo next to `entryUrl`, always. Daily mode must
 * not see a host's `WITCLASH_CONTENT_DIR`. */
export async function loadCanonContent(entryUrl: string): Promise<CategoryRepository> {
  return loadContent(fileURLToPath(new URL("./content/categories", entryUrl)));
}
