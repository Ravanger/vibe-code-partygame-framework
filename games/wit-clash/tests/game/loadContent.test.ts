import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  contentDir,
  loadCanonContent,
  loadContent,
  MIN_CATEGORIES,
} from "../../src/loadContent.js";

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

describe("loadCanonContent", () => {
  it("reads the repo directory next to the entry file, ignoring WITCLASH_CONTENT_DIR", async () => {
    const saved = process.env.WITCLASH_CONTENT_DIR;
    try {
      await mkdir(join(dir, "content", "categories"), { recursive: true });
      for (const id of ["a", "b", "c"])
        await writeFile(join(dir, "content", "categories", `${id}.jsonc`), category(id));
      process.env.WITCLASH_CONTENT_DIR = join(dir, "elsewhere");
      const entry = pathToFileURL(join(dir, "server.ts")).href;
      expect((await loadCanonContent(entry)).all().map((c) => c.id)).toEqual(["a", "b", "c"]);
    } finally {
      if (saved === undefined) delete process.env.WITCLASH_CONTENT_DIR;
      else process.env.WITCLASH_CONTENT_DIR = saved;
    }
  });

  it("refuses to start with too few categories", async () => {
    await mkdir(join(dir, "content", "categories"), { recursive: true });
    await writeFile(join(dir, "content", "categories", "a.json"), category("a"));
    const entry = pathToFileURL(join(dir, "server.ts")).href;
    await expect(loadCanonContent(entry)).rejects.toThrow(
      `Need at least ${MIN_CATEGORIES} categories`,
    );
  });
});
