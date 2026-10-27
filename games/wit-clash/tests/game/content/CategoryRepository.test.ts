import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadCategoriesFromDir } from "../../../src/content/CategoryRepository.js";

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

  it("refuses a category with an unknown field, naming the file and the field", async () => {
    await writeFile(
      join(dir, "x.json"),
      JSON.stringify({ id: "x", name: "X", prompts: [{ id: "x-1", text: "p" }], surprise: true }),
    );
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("x.json");
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow(/surprise/);
  });

  it("refuses a prompt with an unknown field, naming the file and the field path", async () => {
    await writeFile(
      join(dir, "y.json"),
      JSON.stringify({ id: "y", name: "Y", prompts: [{ id: "y-1", text: "p", extra: 1 }] }),
    );
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow("y.json");
    await expect(loadCategoriesFromDir(dir)).rejects.toThrow(/extra/);
  });

  it("refuses a duplicate prompt id across files, naming both files, entries and field paths", async () => {
    await writeFile(
      join(dir, "one.json"),
      JSON.stringify({
        id: "one",
        name: "One",
        prompts: [{ id: "shared", text: "A" }],
        tieBreakers: [],
      }),
    );
    await writeFile(
      join(dir, "two.json"),
      JSON.stringify({
        id: "two",
        name: "Two",
        prompts: [{ id: "other", text: "B" }],
        tieBreakers: [{ id: "shared", text: "C" }],
      }),
    );
    const error = await loadCategoriesFromDir(dir).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Duplicate prompt id "shared"');
    expect(error.message).toContain("one.json");
    expect(error.message).toContain("two.json");
    expect(error.message).toContain('(category "one")');
    expect(error.message).toContain('(category "two")');
    expect(error.message).toContain("prompts[0]");
    expect(error.message).toContain("tieBreakers[0]");
  });

  it("lists every duplicate prompt id in one error", async () => {
    await writeFile(
      join(dir, "a.json"),
      JSON.stringify({
        id: "a",
        name: "A",
        prompts: [
          { id: "dup-1", text: "1" },
          { id: "dup-2", text: "2" },
        ],
      }),
    );
    await writeFile(
      join(dir, "b.json"),
      JSON.stringify({
        id: "b",
        name: "B",
        prompts: [
          { id: "dup-1", text: "again" },
          { id: "dup-2", text: "also again" },
        ],
      }),
    );
    const error = await loadCategoriesFromDir(dir).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('"dup-1"');
    expect(error.message).toContain('"dup-2"');
  });
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
});
