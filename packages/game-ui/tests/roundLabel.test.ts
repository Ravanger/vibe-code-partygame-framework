import { describe, expect, it } from "vitest";
import { roundLabel } from "../src/roundLabel.js";

describe("roundLabel", () => {
  it("labels the current round over the total", () => {
    expect(roundLabel(2, 3)).toBe("Round 2 of 3");
  });

  it("labels a single-round game", () => {
    expect(roundLabel(1, 1)).toBe("Round 1 of 1");
  });

  it("labels round zero when no round has started yet", () => {
    expect(roundLabel(0, 0)).toBe("Round 0 of 0");
  });
});
