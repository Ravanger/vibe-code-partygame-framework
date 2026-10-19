import { required } from "@partygame/core";
import { describe, expect, it } from "vitest";
import { createWitClashGame } from "../../src/game.js";
import { makeCategories } from "./support.js";

describe("createWitClashGame", () => {
  it("records the definition name and replay version", () => {
    const game = createWitClashGame({ categories: makeCategories() });
    expect(game.name).toBe("WitClash");
    expect(game.version).toBe("1");
  });

  it("hashes its categories for exported replay bundles", () => {
    const game = createWitClashGame({ categories: makeCategories() });
    const hash = required(game.contentHash, "contentHash")();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // stable across calls and across instances built from the same content
    expect(required(game.contentHash, "contentHash")()).toBe(hash);
    expect(
      required(createWitClashGame({ categories: makeCategories() }).contentHash, "contentHash")(),
    ).toBe(hash);
    // sensitive to content changes
    const other = createWitClashGame({ categories: makeCategories(3) });
    expect(required(other.contentHash, "contentHash")()).not.toBe(hash);
  });
});
