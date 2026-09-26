import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CategoryRepository } from "../../../games/wit-clash/src/content/CategoryRepository.js";

// Validates the real content files through the production loader. loadFromDir
// silently skips unparseable files, so an exact ID-set assertion is what makes
// a broken or missing file fail loudly instead of shrinking the prompt pool.
const CONTENT_DIR = fileURLToPath(
  new URL("../../../games/wit-clash/content/categories", import.meta.url),
);

const EXPECTED_CATEGORY_IDS = [
  "animals",
  "food",
  "history",
  "movies",
  "music",
  "politics",
  "sci-fi",
  "workplace",
].sort();

describe("WitClash prompt bank (games/wit-clash/content/categories)", () => {
  it("loads every category file through the production schema", async () => {
    const repo = await CategoryRepository.loadFromDir(CONTENT_DIR);
    expect(
      repo
        .all()
        .map((c) => c.id)
        .sort(),
    ).toEqual(EXPECTED_CATEGORY_IDS);
  });

  it("gives each category at least 8 prompts with unique ids", async () => {
    const repo = await CategoryRepository.loadFromDir(CONTENT_DIR);
    for (const category of repo.all()) {
      expect(category.prompts.length, `${category.id} prompt count`).toBeGreaterThanOrEqual(8);
      const ids = category.prompts.map((p) => p.id);
      expect(new Set(ids).size, `${category.id} duplicate prompt ids`).toBe(ids.length);
    }
  });

  it("keeps every prompt and tie-breaker id unique across the whole bank", async () => {
    const repo = await CategoryRepository.loadFromDir(CONTENT_DIR);
    const allIds = repo
      .all()
      .flatMap((c) => [...c.prompts.map((p) => p.id), ...c.tieBreakers.map((t) => t.id)]);
    expect(new Set(allIds).size, "duplicate id across the bank").toBe(allIds.length);
  });
});
