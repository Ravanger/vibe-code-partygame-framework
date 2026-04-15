import { describe, expect, it } from "vitest";
import { CategorySelectionPhase } from "../../src/phases/CategorySelectionPhase";

describe("CategorySelectionPhase", () => {
  it("should select 3 random categories from input list", () => {
    const phase = new CategorySelectionPhase();
    const categories = ["A", "B", "C", "D", "E"];
    const selection = phase.getRandomCategories(categories, 3);
    expect(selection).toHaveLength(3);
    expect(new Set(selection).size).toBe(3);
  });

  it("should handle count larger than categories", () => {
    const phase = new CategorySelectionPhase();
    const categories = ["A", "B"];
    const result = phase.getRandomCategories(categories, 5);
    expect(result).toHaveLength(2);
  });

  it("should return categories from the input list", () => {
    const phase = new CategorySelectionPhase();
    const categories = ["A", "B", "C"];
    const result = phase.getRandomCategories(categories, 2);
    result.forEach((cat) => expect(categories).toContain(cat));
  });

  it("should return unique categories", () => {
    const phase = new CategorySelectionPhase();
    const categories = ["A", "B", "C", "D", "E"];
    const result = phase.getRandomCategories(categories, 3);
    expect(new Set(result).size).toBe(result.length);
  });
});
