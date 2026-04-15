import { ArraySchema } from "@colyseus/schema";
import { expect, test } from "vitest";
import { GameStateSchema } from "../src/schema/GameStateSchema";

test("schema includes new fields", () => {
  const state = new GameStateSchema();

  expect(state.currentVotingOptions).toBeInstanceOf(ArraySchema);
  expect([...state.currentVotingOptions]).toEqual([]);
  expect(state.selectedCategory).toBe("");
});
