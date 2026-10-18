import { describe, expect, it } from "vitest";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { createBluffGame } from "../../src/game.js";
import { META } from "../../src/meta.js";

const onePrompt = () => promptsFromArray([{ id: "a", question: "Q?", truth: "A" }]);

describe("createBluffGame", () => {
  it("records the definition name, version and limits", () => {
    const game = createBluffGame({ prompts: onePrompt() });
    expect(game.name).toBe("Bluff");
    expect(game.version).toBe("1");
    expect(game.minPlayers).toBe(META.minPlayers);
    expect(game.maxPlayers).toBe(META.maxPlayers);
    expect(game.startPhase).toBe("Writing");
  });

  it("refuses to start without any prompts", () => {
    expect(() => createBluffGame({ prompts: promptsFromArray([]) })).toThrow(
      "Bluff needs at least one prompt",
    );
  });
});
