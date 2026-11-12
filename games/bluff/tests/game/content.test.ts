import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { loadPrompts, promptsFromArray } from "../../src/content/PromptRepository.js";
import { contentDir, loadContent, MIN_PROMPTS } from "../../src/loadContent.js";

const REPO_CONTENT = join(import.meta.dirname, "..", "..", "content", "prompts");

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "bluff-"));
});

const prompt = (id: string) => ({ id, question: `Question ${id}?`, truth: `Answer ${id}` });
const packText = (id: string, prompts: unknown[]) => JSON.stringify({ id, prompts });
const writePacks = (...files: [name: string, text: string][]) =>
  Promise.all(files.map(([name, text]) => writeFile(join(dir, name), text)));

describe("contentDir", () => {
  it("defaults to content/prompts next to the entry file", () => {
    const entry = pathToFileURL(join(dir, "server.ts")).href;
    expect(contentDir({}, entry)).toBe(join(dir, "content", "prompts"));
  });
});

describe("PromptRepository", () => {
  it("returns a copy of the prompts and looks them up by id", () => {
    const prompts = promptsFromArray([
      { id: "a", question: "Q?", truth: "A" },
      { id: "b", question: "R?", truth: "B" },
    ]);
    prompts.all().push({ id: "c", question: "S?", truth: "C" });
    expect(prompts.all().map((p) => p.id)).toEqual(["a", "b"]);
    expect(prompts.byId("b")?.truth).toBe("B");
    expect(prompts.byId("nope")).toBeUndefined();
  });
});

describe("loadPrompts", () => {
  it("loads every prompt of the pack files in name order, ignoring comments", async () => {
    await writePacks(
      [
        "a.jsonc",
        `// a pack\n{\n  /* the list */\n  "id": "alpha",\n  "prompts": [${JSON.stringify(
          prompt("a1"),
        )}]\n}`,
      ],
      ["b.jsonc", packText("beta", [prompt("b1"), prompt("b2")])],
    );
    const repo = await loadPrompts(dir);
    expect(repo.all().map((p) => p.id)).toEqual(["a1", "b1", "b2"]);
  });

  it("rejects a prompt with an invalid id", async () => {
    await writePacks([
      "a.jsonc",
      packText("alpha", [{ id: "Bad Id", question: "Q?", truth: "A" }]),
    ]);
    await expect(loadPrompts(dir)).rejects.toThrow("failed validation");
  });

  it("rejects a duplicate prompt id across files and names both files", async () => {
    await writePacks(
      ["a.jsonc", packText("alpha", [prompt("x")])],
      ["b.jsonc", packText("beta", [prompt("x")])],
    );
    await expect(loadPrompts(dir)).rejects.toThrow(
      'Duplicate Prompt id "x" in b.jsonc; already used in a.jsonc',
    );
  });

  it("rejects a duplicate pack id", async () => {
    await writePacks(
      ["a.jsonc", packText("same", [prompt("a1")])],
      ["b.jsonc", packText("same", [prompt("b1")])],
    );
    await expect(loadPrompts(dir)).rejects.toThrow('Duplicate Prompt id "same" in b.jsonc');
  });

  it("rejects an empty prompt list", async () => {
    await writePacks(["a.jsonc", packText("alpha", [])]);
    await expect(loadPrompts(dir)).rejects.toThrow("failed validation");
  });

  it("rejects invalid JSON", async () => {
    await writePacks(["a.jsonc", "{ not json"]);
    await expect(loadPrompts(dir)).rejects.toThrow("Invalid JSON");
  });

  it("rejects a missing directory", async () => {
    await expect(loadPrompts(join(dir, "nope"))).rejects.toThrow("Prompt directory not found");
  });
});

describe("loadContent", () => {
  it("refuses to start with fewer than the minimum prompts", async () => {
    const ids = Array.from({ length: MIN_PROMPTS - 1 }, (_, i) => `p${i}`);
    await writePacks(["a.jsonc", packText("alpha", ids.map(prompt))]);
    await expect(loadContent(dir)).rejects.toThrow(
      `Need at least ${MIN_PROMPTS} prompts in ${dir}, found ${MIN_PROMPTS - 1}`,
    );
  });

  it("loads the repo-shipped prompts", async () => {
    const prompts = await loadContent(REPO_CONTENT);
    expect(prompts.all().length).toBe(20);
    expect(prompts.byId("most-time-zones")?.truth).toBe("France");
  });
});
