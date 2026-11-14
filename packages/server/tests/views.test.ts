import { describe, expect, it } from "vitest";
import { waitForOwnEntry } from "../src/testing/index.js";
import { BuzzerState, SecretSchema } from "./fixtures/buzzer.js";

const secret = (word: string) => {
  const s = new SecretSchema();
  s.word = word;
  return s;
};

describe("waitForOwnEntry", () => {
  it("resolves with the own entry once the map holds exactly one entry keyed by the player", async () => {
    const state = new BuzzerState();
    const pending = waitForOwnEntry(state, "player-0001", (s) => s.secrets);
    setTimeout(() => {
      state.secrets.set("player-0001", secret("own"));
    }, 20);
    await expect(pending).resolves.toMatchObject({ word: "own" });
  });

  it("keeps polling while the single entry belongs to someone else, then resolves with the own one", async () => {
    const state = new BuzzerState();
    state.secrets.set("player-0002", secret("theirs"));
    const pending = waitForOwnEntry(state, "player-0001", (s) => s.secrets, "own");
    setTimeout(() => {
      state.secrets.clear();
      state.secrets.set("player-0001", secret("own"));
    }, 20);
    await expect(pending).resolves.toMatchObject({ word: "own" });
  });

  it("keeps polling while the decoded view map is absent, then resolves with the own entry", async () => {
    const state = new BuzzerState();
    let visible = false;
    const pending = waitForOwnEntry(
      state,
      "player-0001",
      (s) => (visible ? s.secrets : undefined),
      "own",
    );
    setTimeout(() => {
      visible = true;
      state.secrets.set("player-0001", secret("own"));
    }, 20);
    await expect(pending).resolves.toMatchObject({ word: "own" });
  });

  it("rejects with the label when the own entry never appears", async () => {
    const state = new BuzzerState();
    await expect(waitForOwnEntry(state, "player-0001", (s) => s.secrets, "own")).rejects.toThrow(
      /Timed out waiting for own/,
    );
  }, 10_000);
});
