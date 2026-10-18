import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { loadPromptsFromDir, promptsFromArray } from "../../src/content/PromptRepository.js";
import { contentDir, loadContent, MIN_PROMPTS } from "../../src/loadContent.js";

const REPO_CONTENT = join(import.meta.dirname, "..", "..", "content", "prompts");

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "bluff-"));
});

const promptFile = (id: string) =>
  JSON.stringify({ id, question: `Question ${id}?`, truth: `Answer ${id}` });

describe("contentDir", () => {
  it("prefers BLUFF_CONTENT_DIR", () => {
    expect(contentDir({ BLUFF_CONTENT_DIR: "/somewhere" }, "file:///game/server.ts")).toBe(
      "/somewhere",
    );
  });

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

describe("loadPromptsFromDir", () => {
  it("loads the prompts of a directory in file order", async () => {
    for (const id of ["a", "b"]) await writeFile(join(dir, `${id}.jsonc`), promptFile(id));
    const repo = await loadPromptsFromDir(dir);
    expect(repo.all().map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("rejects a prompt file with an invalid id", async () => {
    await writeFile(
      join(dir, "bad.jsonc"),
      JSON.stringify({ id: "Bad Id", question: "Q?", truth: "A" }),
    );
    await expect(loadPromptsFromDir(dir)).rejects.toThrow();
  });
});

describe("loadContent", () => {
  it("refuses to start with fewer than the minimum prompts", async () => {
    for (let i = 0; i < MIN_PROMPTS - 1; ++i)
      await writeFile(join(dir, `p${i}.jsonc`), promptFile(`p${i}`));
    await expect(loadContent(dir)).rejects.toThrow(
      `Need at least ${MIN_PROMPTS} prompts in ${dir}, found ${MIN_PROMPTS - 1}`,
    );
  });

  it("loads the repo-shipped prompts", async () => {
    const prompts = await loadContent(REPO_CONTENT);
    expect(prompts.all().length).toBe(8);
    expect(prompts.byId("australia-capital")?.truth).toBe("Canberra");
  });
});
