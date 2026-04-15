import { unlink, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { PromptLoader } from "../src/PromptLoader.js";

describe("PromptLoader", () => {
  it("should fail if file is missing", async () => {
    await expect(PromptLoader.load("nonexistent.jsonc")).rejects.toThrow();
  });

  it("should fail if JSONC content is malformed", async () => {
    const path = "invalid.jsonc";
    await writeFile(path, '{ "version": "1.0", "bad": "data" }');
    await expect(PromptLoader.load(path)).rejects.toThrow();
    await unlink(path);
  });

  it("should pass if JSONC is valid", async () => {
    const path = "valid.jsonc";
    const data = { version: "1.0", prompts: [{ id: "p1", text: "hi" }], tieBreakers: [] };
    await writeFile(path, JSON.stringify(data));
    const result = await PromptLoader.load(path);
    expect(result.version).toBe("1.0");
    await unlink(path);
  });

  it("should select a random prompt from the list", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const prompts = [
      { id: "p1", text: "first" },
      { id: "p2", text: "second" },
    ];

    expect(PromptLoader.getRandomPrompt(prompts)).toEqual(prompts[1]);

    randomSpy.mockRestore();
  });
});
