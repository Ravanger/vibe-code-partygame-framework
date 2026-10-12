import { describe, expect, it } from "vitest";
import { createWitClashGame } from "../../src/game.js";
import { makeCategories } from "./support.js";

describe("createWitClashGame", () => {
  it("records the definition name and replay version", () => {
    const game = createWitClashGame({ categories: makeCategories() });
    expect(game.name).toBe("WitClash");
    expect(game.version).toBe("1");
  });
});
