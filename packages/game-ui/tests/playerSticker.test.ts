import { describe, expect, it } from "vitest";
import { playerSticker, STICKER_SHAPES, stickerLetter } from "../src/playerSticker.js";

describe("playerSticker", () => {
  it("is stable for a player", () => {
    expect(playerSticker("player-1")).toEqual(playerSticker("player-1"));
  });

  it("spreads players over every shape and colour index", () => {
    const shapes = new Set<string>();
    const colorIndices = new Set<number>();
    for (let i = 0; i < 300; ++i) {
      const { shape, colorIndex } = playerSticker(`id-${i}`);
      shapes.add(shape);
      expect(colorIndex).toBeGreaterThanOrEqual(0);
      expect(colorIndex).toBeLessThan(4);
      colorIndices.add(colorIndex);
    }
    expect([...shapes].sort()).toEqual([...STICKER_SHAPES].sort());
    expect([...colorIndices].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("stickerLetter", () => {
  it("is the first letter, capitalised", () => {
    expect(stickerLetter("  maya lee")).toBe("M");
  });

  it("falls back to a question mark without a name", () => {
    expect(stickerLetter("   ")).toBe("?");
    expect(stickerLetter("")).toBe("?");
  });
});
