import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptLoader } from "../src/PromptLoader";

vi.mock("node:fs", () => ({
  default: {
    readdirSync: vi.fn((): string[] => []),
  },
}));

describe("PromptLoader Themes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should discover all json files in prompts directory as categories", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock requires any for fs.readdirSync type compatibility
    vi.spyOn(fs, "readdirSync").mockReturnValue(["pop.json", "niche.json"] as any);
    const loader = new PromptLoader("mock/path");
    expect(loader.getAvailableCategories()).toEqual(["pop", "niche"]);
  });
});
