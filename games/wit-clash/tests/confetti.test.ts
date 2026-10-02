import { describe, expect, it } from "vitest";
import { confettiPieces } from "../ui/confetti.js";

describe("confettiPieces", () => {
  it("makes the requested number of pieces inside the screen with palette colours", () => {
    const pieces = confettiPieces(40);
    expect(pieces).toHaveLength(40);
    for (const piece of pieces) {
      expect(piece.left).toBeGreaterThanOrEqual(0);
      expect(piece.left).toBeLessThan(100);
      expect(piece.duration).toBeGreaterThan(2);
      expect(piece.color).toMatch(/^var\(--/);
    }
    expect(new Set(pieces.map((piece) => piece.color)).size).toBe(5);
  });

  it("is the same every time", () => {
    expect(confettiPieces(5)).toEqual(confettiPieces(5));
  });
});
