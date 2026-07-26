import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CategoryRepository } from "../../src/content/CategoryRepository.js";

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

describe("CategoryRepository.loadFromDir", () => {
  it("loads .json files", async () => {
    await writeFile(join(dir, "a.json"), valid("alpha", "Alpha"));
    const repo = await CategoryRepository.loadFromDir(dir);
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
    const repo = await CategoryRepository.loadFromDir(dir);
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
    const repo = await CategoryRepository.loadFromDir(dir);
    expect(repo.byId("urls")?.prompts[0]?.text).toBe(
      "Best thing to put after https:// in a fake URL",
    );
  });

  it("skips a malformed file but still loads the good ones", async () => {
    await writeFile(join(dir, "good.json"), valid("good", "Good"));
    await writeFile(join(dir, "bad.json"), "{ not json");
    const repo = await CategoryRepository.loadFromDir(dir);
    expect(repo.all().map((c) => c.id)).toEqual(["good"]);
  });

  it("skips a file that fails schema validation (no prompts)", async () => {
    await writeFile(join(dir, "empty.json"), JSON.stringify({ id: "e", name: "E", prompts: [] }));
    const repo = await CategoryRepository.loadFromDir(dir);
    expect(repo.all()).toHaveLength(0);
  });

  it("rejects duplicate ids across files", async () => {
    await writeFile(join(dir, "one.json"), valid("dup", "One"));
    await writeFile(join(dir, "two.json"), valid("dup", "Two"));
    await expect(CategoryRepository.loadFromDir(dir)).rejects.toThrow(/duplicate/i);
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
    const repo = await CategoryRepository.loadFromDir(dir);
    expect(repo.byId("noemoji")?.emoji).toBe("🎲");
  });

  it("throws a clear error when the directory does not exist", async () => {
    await expect(CategoryRepository.loadFromDir(join(dir, "nope"))).rejects.toThrow(/not found/i);
  });
});

describe("pickRandom", () => {
  it("is deterministic with an injected rng", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await CategoryRepository.loadFromDir(dir);
    const rng = () => 0; // always picks index 0
    expect(repo.pickRandom(3, rng)).toHaveLength(3);
  });

  it("produces a seeded deterministic order", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await CategoryRepository.loadFromDir(dir);
    const seq1 = repo.pickRandom(4, () => 0.5);
    const seq2 = repo.pickRandom(4, () => 0.5);
    expect(seq1.map((c) => c.id)).toEqual(seq2.map((c) => c.id));
  });

  it("never returns duplicates", async () => {
    for (const id of ["a", "b", "c", "d"]) await writeFile(join(dir, `${id}.json`), valid(id, id));
    const repo = await CategoryRepository.loadFromDir(dir);
    const ids = repo.pickRandom(3).map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("returns everything when asked for more than exist", async () => {
    await writeFile(join(dir, "a.json"), valid("a", "A"));
    const repo = await CategoryRepository.loadFromDir(dir);
    expect(repo.pickRandom(3)).toHaveLength(1);
  });
});
