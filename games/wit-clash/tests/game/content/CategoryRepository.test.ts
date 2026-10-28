import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mulberry32 } from "@partygame/core";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCategoriesFromDir } from "../../../src/content/CategoryRepository.js";
import { nth } from "../support.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "cats-"));
});

const valid = (id: string, name: string) =>
  JSON.stringify({
    id,
    name,
    emoji: "🎲",
    prompts: [{ id: `${id}-1`, text: "Prompt one" }],
  });

describe("loadCategoriesFromDir", () => {
  it("loads .json files", async () => {
    await writeFile(join(dir, "a.json"), valid("alpha", "Alpha"));
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.all().map((c) => c.id)).toEqual(["alpha"]);
  });

  it("loads .jsonc files with comments (the current loader cannot)", async () => {
    await writeFile(
      join(dir, "b.jsonc"),
      `{
      // a leading comment
      "id": "beta", "name": "Beta", "emoji": "🅱️",
      "prompts": [{ "id": "b-1", "text": "Hi" }]   /* trailing block */
    }`,
    );
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.byId("beta")?.name).toBe("Beta");
  });

  it("preserves // inside prompt text", async () => {
    await writeFile(
      join(dir, "c.jsonc"),
      JSON.stringify({
        id: "urls",
        name: "URLs",
        emoji: "🔗",
        prompts: [{ id: "u-1", text: "Best thing to put after https:// in a fake URL" }],
      }),
    );
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.byId("urls")?.prompts[0]?.text).toBe(
      "Best thing to put after https:// in a fake URL",
    );
  });

  it("refuses a directory with a malformed file, naming it", async () => {
    await writeFile(join(dir, "good.json"), valid("good", "Good"));
    await writeFile(join(dir, "bad.json"), "{ not json");
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("bad.json");
  });

  it("refuses a file that fails schema validation (no prompts), naming the entry", async () => {
    await writeFile(join(dir, "empty.json"), JSON.stringify({ id: "e", name: "E", prompts: [] }));
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("empty.json");
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow(/prompts/);
  });

  it("rejects duplicate ids across files", async () => {
    await writeFile(join(dir, "one.json"), valid("dup", "One"));
    await writeFile(join(dir, "two.json"), valid("dup", "Two"));
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow(/duplicate/i);
  });

  it("defaults emoji when omitted", async () => {
    await writeFile(
      join(dir, "d.json"),
      JSON.stringify({
        id: "noemoji",
        name: "No Emoji",
        prompts: [{ id: "n-1", text: "x" }],
      }),
    );
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.byId("noemoji")?.emoji).toBe("🎲");
  });

  it("throws a clear error when the directory does not exist", async () => {
    await expect(loadCategoriesFromDir(join(dir, "nope"))).rejects.toThrow(/not found/i);
  });

  it("defaults weight to 1 and rating to family when omitted", async () => {
    await writeFile(join(dir, "a.json"), valid("alpha", "Alpha"));
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.byId("alpha")?.weight).toBe(1);
    expect(repo.byId("alpha")?.rating).toBe("family");
  });

  it("accepts an explicit weight of 0 and a mature rating", async () => {
    await writeFile(
      join(dir, "m.json"),
      JSON.stringify({
        id: "mature-zero",
        name: "Mature Zero",
        prompts: [{ id: "mz-1", text: "x" }],
        weight: 0,
        rating: "mature",
      }),
    );
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.byId("mature-zero")?.weight).toBe(0);
    expect(repo.byId("mature-zero")?.rating).toBe("mature");
  });

  it("rejects a negative weight, naming the file", async () => {
    await writeFile(
      join(dir, "neg.json"),
      JSON.stringify({ id: "n", name: "N", prompts: [{ id: "n-1", text: "x" }], weight: -1 }),
    );
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("neg.json");
  });

  it("rejects an unknown rating, naming the file", async () => {
    await writeFile(
      join(dir, "spicy.json"),
      JSON.stringify({ id: "s", name: "S", prompts: [{ id: "s-1", text: "x" }], rating: "spicy" }),
    );
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("spicy.json");
  });
});

/** A seeded PRNG so distribution tests run identically on every machine. */
const seeded = (seed: number): (() => number) => mulberry32(seed);

const weighted = (id: string, weight: number, rating: "family" | "mature" = "family") =>
  JSON.stringify({
    id,
    name: id,
    emoji: "🎲",
    prompts: [{ id: `${id}-1`, text: "P" }],
    weight,
    rating,
  });

describe("pickRandom", () => {
  it("is deterministic with an injected rng", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await loadCategoriesFromDir(dir);
    const rng = () => 0; // always picks index 0
    expect(repo.pickRandom(3, rng)).toHaveLength(3);
  });

  it("produces a seeded deterministic order", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await loadCategoriesFromDir(dir);
    const seq1 = repo.pickRandom(4, () => 0.5);
    const seq2 = repo.pickRandom(4, () => 0.5);
    expect(seq1.map((c) => c.id)).toEqual(seq2.map((c) => c.id));
  });

  it("never returns duplicates", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await loadCategoriesFromDir(dir);
    const ids = repo.pickRandom(3).map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("returns everything when asked for more than exist", async () => {
    await writeFile(join(dir, "a.json"), valid("a", "A"));
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.pickRandom(3)).toHaveLength(1);
  });

  it("never offers a category with weight 0", async () => {
    await writeFile(join(dir, "zero.json"), weighted("zero", 0));
    await writeFile(join(dir, "a.json"), weighted("a", 1));
    await writeFile(join(dir, "b.json"), weighted("b", 2));
    const repo = await loadCategoriesFromDir(dir);
    // constant rng: every key is 1 and the pool order decides, so the result must be exactly the eligible pool
    expect(repo.pickRandom(3, () => 1).map((c) => c.id)).toEqual(["a", "b"]);
    for (let s = 0; s < 200; ++s) {
      expect(repo.pickRandom(1, seeded(s)).map((c) => c.id)).not.toContain("zero");
    }
  });

  it("offers a heavier category far more often over many seeded runs", async () => {
    await writeFile(join(dir, "heavy.json"), weighted("heavy", 10));
    await writeFile(join(dir, "light.json"), weighted("light", 1));
    const repo = await loadCategoriesFromDir(dir);
    let heavy = 0;
    for (let s = 0; s < 2000; ++s) {
      if (repo.pickRandom(1, seeded(s))[0]?.id === "heavy") ++heavy;
    }
    // P(heavy) = 10/11 ≈ 0.91, so a weighted draw lands well above the uniform half
    expect(heavy).toBeGreaterThan(1600);
  });

  it("picks uniformly when all weights are equal", async () => {
    for (const id of ["a", "b", "c", "d"])
      await writeFile(join(dir, `${id}.json`), weighted(id, 1));
    const repo = await loadCategoriesFromDir(dir);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (let s = 0; s < 2000; ++s) {
      const id = nth(repo.pickRandom(1, seeded(s)), 0).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const id of ["a", "b", "c", "d"]) expect(counts[id]).toBeGreaterThanOrEqual(400);
    for (const id of ["a", "b", "c", "d"]) expect(counts[id]).toBeLessThanOrEqual(600);
  });

  it("honours the optional filter before drawing", async () => {
    await writeFile(join(dir, "a.json"), weighted("a", 1));
    await writeFile(join(dir, "b.json"), weighted("b", 1));
    await writeFile(join(dir, "c.json"), weighted("c", 1, "mature"));
    const repo = await loadCategoriesFromDir(dir);
    expect(repo.pickRandom(3).map((c) => c.id)).toHaveLength(3);
    expect(
      repo
        .pickRandom(
          3,
          () => 0.5,
          (c) => c.rating === "family",
        )
        .map((c) => c.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });
});
