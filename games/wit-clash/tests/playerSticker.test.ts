import { describe, expect, it } from "vitest";
import { playerSticker, STICKER_SHAPES, stickerLetter } from "../ui/playerSticker.js";

describe("playerSticker", () => {
  it("is stable for a player", () => {
    expect(playerSticker("player-1")).toEqual(playerSticker("player-1"));
  });

  it("spreads players over every shape and colour", () => {
    const shapes = new Set<string>();
    const colors = new Set<string>();
    for (let i = 0; i < 300; ++i) {
      const { shape, color } = playerSticker(`id-${i}`);
      shapes.add(shape);
      colors.add(color);
    }
    expect([...shapes].sort()).toEqual([...STICKER_SHAPES].sort());
    expect([...colors].sort()).toEqual(["var(--mint)", "var(--pink)", "var(--sky)", "var(--sun)"]);
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
