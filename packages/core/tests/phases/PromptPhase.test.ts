import { describe, expect, it } from "vitest";
import { PromptPhase } from "../../src/phases/PromptPhase.js";

describe("PromptPhase", () => {
  const phase = new PromptPhase();

  it("should handle SubmitAnswer action", () => {
    expect(() => phase.handleAction("p1", { type: "SubmitAnswer", data: {} })).not.toThrow();
  });

  it("should throw for invalid action type", () => {
    expect(() => phase.handleAction("p1", { type: "Invalid" as any, data: {} })).toThrow("Invalid Action");
  });

  it("should compute visibility", () => {
    expect(phase.computeVisibility()).toEqual({ phase: "Prompting" });
  });
});
