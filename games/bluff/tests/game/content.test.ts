import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { loadPrompts, promptsFromArray } from "../../src/content/PromptRepository.js";
import { contentDir, loadContent, MIN_PROMPTS } from "../../src/loadContent.js";

const REPO_CONTENT = join(import.meta.dirname, "..", "..", "content");
const FILE = "prompts.jsonc";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "bluff-"));
});

const prompt = (id: string) => ({ id, question: `Question ${id}?`, truth: `Answer ${id}` });
const fileText = (prompts: unknown[]) => JSON.stringify({ prompts });
const writePrompts = (text: string) => writeFile(join(dir, FILE), text);

describe("contentDir", () => {
  it("prefers BLUFF_CONTENT_DIR", () => {
    expect(contentDir({ BLUFF_CONTENT_DIR: "/somewhere" }, "file:///game/server.ts")).toBe(
      "/somewhere",
    );
  });

  it("defaults to content next to the entry file", () => {
    const entry = pathToFileURL(join(dir, "server.ts")).href;
    expect(contentDir({}, entry)).toBe(join(dir, "content"));
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
  it("loads the prompts of the file in order, ignoring comments", async () => {
    await writePrompts(
      `// one prompt per line of JSON\n{\n  /* the list */\n  "prompts": [${JSON.stringify(
        prompt("a"),
      )}, ${JSON.stringify(prompt("b"))}]\n}`,
    );
    const repo = await loadPrompts(join(dir, FILE));
    expect(repo.all().map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("rejects a prompt with an invalid id", async () => {
    await writePrompts(fileText([{ id: "Bad Id", question: "Q?", truth: "A" }]));
    await expect(loadPrompts(join(dir, FILE))).rejects.toThrow("failed validation");
  });

  it("rejects duplicate ids", async () => {
    await writePrompts(fileText([prompt("a"), prompt("a")]));
    await expect(loadPrompts(join(dir, FILE))).rejects.toThrow('Duplicate Prompt id "a"');
  });

  it("rejects an empty prompt list", async () => {
    await writePrompts(fileText([]));
    await expect(loadPrompts(join(dir, FILE))).rejects.toThrow("failed validation");
  });

  it("rejects invalid JSON", async () => {
    await writePrompts("{ not json");
    await expect(loadPrompts(join(dir, FILE))).rejects.toThrow("Invalid JSON");
  });

  it("rejects a missing file", async () => {
    await expect(loadPrompts(join(dir, "nope.jsonc"))).rejects.toThrow("Prompt file not found");
  });
});

describe("loadContent", () => {
  it("refuses to start with fewer than the minimum prompts", async () => {
    const ids = Array.from({ length: MIN_PROMPTS - 1 }, (_, i) => `p${i}`);
    await writePrompts(fileText(ids.map(prompt)));
    await expect(loadContent(dir)).rejects.toThrow(
      `Need at least ${MIN_PROMPTS} prompts in ${join(dir, FILE)}, found ${MIN_PROMPTS - 1}`,
    );
  });

  it("loads the repo-shipped prompts", async () => {
    const prompts = await loadContent(REPO_CONTENT);
    expect(prompts.all().length).toBe(20);
    expect(prompts.byId("most-time-zones")?.truth).toBe("France");
  });
});
