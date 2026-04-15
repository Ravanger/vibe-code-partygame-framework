import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptLoader } from "../src/PromptLoader";

vi.mock("node:fs", () => ({
  default: {
    readdirSync: vi.fn(),
  },
}));

describe("PromptLoader Themes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should discover all json files in prompts directory as categories", () => {
    vi.spyOn(fs, "readdirSync").mockReturnValue([
      "pop.json",
      "niche.json",
    ] as unknown as fs.Dirent[]);
    const loader = new PromptLoader("mock/path");
    expect(loader.getAvailableCategories()).toEqual(["pop", "niche"]);
  });
});
