import { assertSyncedFields } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { META } from "../../src/meta.js";
import { PHASE } from "../../src/phaseNames.js";
import { BLUFF_PUBLIC_FIELDS, BluffOption, BluffState, ScoreEntry } from "../../src/state.js";

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

  it("loads the shipped prompts from the content directory", async () => {
    if (gamePackage.load === undefined) throw new Error("expected a load function");
    const prompts = await gamePackage.load({});
    expect(prompts.all().length).toBeGreaterThanOrEqual(6);
  });

  describe("demo narration", () => {
    const narrate = (state: BluffState): readonly string[] => {
      if (gamePackage.demo?.commentator === undefined) throw new Error("expected a commentator");
      return gamePackage.demo.commentator().narrate(state);
    };
    const at = (phase: string): BluffState => {
      const state = new BluffState();
      state.phase = phase;
      state.promptText = "Why?";
      return state;
    };

    it("says nothing outside the game phases", () => {
      expect(narrate(new BluffState())).toEqual([]);
    });

    it("narrates writing and voting", () => {
      expect(narrate(at(PHASE.Writing))).toEqual(["Writing — Why?"]);
      expect(narrate(at(PHASE.Voting))).toEqual(["Vote on the real answer"]);
    });

    it("names the truth on reveal, or a placeholder when it is missing", () => {
      const state = at(PHASE.Reveal);
      expect(narrate(state)).toEqual(["The truth was: ?"]);
      const choice = new BluffOption();
      choice.id = "c1";
      choice.text = "Canberra";
      state.choices.push(choice);
      state.truthRevealedId = "c1";
      expect(narrate(state)).toEqual(["The truth was: Canberra"]);
    });

    it("announces the leader in the results, or a bare final line without one", () => {
      const state = at(PHASE.Results);
      expect(narrate(state)).toEqual(["Final"]);
      const row = new ScoreEntry();
      row.name = "Ann";
      row.score = 7;
      state.scoreboard.push(row);
      expect(narrate(state)).toEqual(["Final — Ann leads with 7"]);
    });
  });
});
