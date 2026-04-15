import type { GameAction } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { PromptPhase } from "../../src/phases/PromptPhase.js";

describe("PromptPhase", () => {
  it("should create instance via constructor", () => {
    const phase = new PromptPhase();
    expect(phase).toBeDefined();
  });

  it("should handle SubmitAnswer action", () => {
    const phase = new PromptPhase();
    expect(() => phase.handleAction("p1", { type: "SubmitAnswer", answer: "test" })).not.toThrow();
  });

  it("should throw for invalid action type", () => {
    const phase = new PromptPhase();
    expect(() => phase.handleAction("p1", { type: "Invalid", data: {} } as GameAction)).toThrow(
      "Invalid Action",
    );
  });

  it("should compute visibility", () => {
    const phase = new PromptPhase();
    expect(phase.computeVisibility()).toEqual({ phase: "Prompting" });
  });

  it("should handle SubmitAnswer with different player", () => {
    const phase = new PromptPhase();
    expect(() => phase.handleAction("p2", { type: "SubmitAnswer", answer: "hello" })).not.toThrow();
  });
});
