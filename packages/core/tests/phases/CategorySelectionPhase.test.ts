import { describe, expect, it } from "vitest";
import { CategorySelectionPhase } from "../../src/phases/CategorySelectionPhase";

describe("CategorySelectionPhase", () => {
  it("should select 3 random categories from input list", () => {
    const phase = new CategorySelectionPhase();
    const categories = ["A", "B", "C", "D", "E"];
    const selection = phase.getRandomCategories(categories, 3);
    expect(selection).toHaveLength(3);
    // ensure unique
    expect(new Set(selection).size).toBe(3);
  });
});
