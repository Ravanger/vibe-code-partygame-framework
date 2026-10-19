import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { META } from "../../src/meta.js";
import { BluffState } from "../../src/state.js";

describe("gamePackage", () => {
  it("describes the bluff game for a server to host", () => {
    expect(gamePackage.meta).toBe(META);
    expect(gamePackage.stateClass).toBe(BluffState);
    const prompts = promptsFromArray([
      { id: "p1", question: "What is the capital of Australia?", truth: "Canberra" },
    ]);
    expect(gamePackage.definition(prompts).name).toBe("Bluff");
  });
});
