import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { contentDir, loadContent, MIN_CATEGORIES } from "../../src/loadContent.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "witclash-"));
});

const category = (id: string) =>
  JSON.stringify({ id, name: id, prompts: [{ id: `${id}-1`, text: "Say something." }] });

describe("contentDir", () => {
  it("prefers WITCLASH_CONTENT_DIR", () => {
    expect(contentDir({ WITCLASH_CONTENT_DIR: "/somewhere" }, "file:///game/server.ts")).toBe(
      "/somewhere",
    );
  });

  it("defaults to content/categories next to the entry file", () => {
    const entry = pathToFileURL(join(dir, "server.ts")).href;
    expect(contentDir({}, entry)).toBe(join(dir, "content", "categories"));
  });
});

describe("loadContent", () => {
  it("loads the categories of a directory", async () => {
    for (const id of ["a", "b", "c"])
      await writeFile(join(dir, `${id}.jsonc`), `// c\n${category(id)}`);
    const categories = await loadContent(dir);
    expect(categories.all().map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("refuses to start with too few categories", async () => {
    await writeFile(join(dir, "a.json"), category("a"));
    await expect(loadContent(dir)).rejects.toThrow(`Need at least ${MIN_CATEGORIES} categories`);
  });

  it("reports a missing directory", async () => {
    await expect(loadContent(join(dir, "missing"))).rejects.toThrow(/not found/);
  });

  it("loads the shipped content", async () => {
    const shipped = join(import.meta.dirname, "..", "..", "content", "categories");
    expect((await loadContent(shipped)).all().length).toBeGreaterThanOrEqual(MIN_CATEGORIES);
  });
});
