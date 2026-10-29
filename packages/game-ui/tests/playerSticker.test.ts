import { describe, expect, it } from "vitest";
import { playerSticker, STICKER_SHAPES, stickerLetter } from "../src/playerSticker.js";

describe("playerSticker", () => {
  it("is stable for a player", () => {
    expect(playerSticker("player-1")).toEqual(playerSticker("player-1"));
  });

  it("spreads players over every shape and colour index", () => {
    const shapes = new Set<string>();
    const colors = new Set<number>();
    for (let i = 0; i < 300; ++i) {
      const { shape, colorIndex } = playerSticker(`id-${i}`);
      shapes.add(shape);
      colors.add(colorIndex);
    }
    expect([...shapes].sort()).toEqual([...STICKER_SHAPES].sort());
    expect([...colors].sort()).toEqual([0, 1, 2, 3]);
  });

  it("maps a player id to its stable shape and colour index", () => {
    expect(playerSticker("player-1")).toEqual({ shape: "star", colorIndex: 2 });
    expect(playerSticker("maya")).toEqual({ shape: "heart", colorIndex: 0 });
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
