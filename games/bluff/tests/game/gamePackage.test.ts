import { assertSyncedFields } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { META } from "../../src/meta.js";
import { BLUFF_PUBLIC_FIELDS, BluffState } from "../../src/state.js";

describe("gamePackage", () => {
  it("describes the bluff game for a server to host", () => {
    expect(gamePackage.meta).toBe(META);
    expect(gamePackage.stateClass).toBe(BluffState);
    const prompts = promptsFromArray([
      { id: "p1", question: "What is the capital of Australia?", truth: "Canberra" },
    ]);
    expect(gamePackage.definition(prompts).name).toBe("Bluff");
  });

  it("declares every synced field so createGameServer can host BluffState", () => {
    expect(gamePackage.publicFields).toBe(BLUFF_PUBLIC_FIELDS);
    expect(() => assertSyncedFields(BluffState, BLUFF_PUBLIC_FIELDS)).not.toThrow();
    expect(BLUFF_PUBLIC_FIELDS).not.toContain("mine");
  });
});
