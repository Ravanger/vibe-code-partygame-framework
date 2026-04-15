import { ArraySchema, MapSchema } from "@colyseus/schema";
import { expect, test } from "vitest";
import { GameStateSchema } from "../src/schema/GameStateSchema";

test("schema includes new fields", () => {
  const state = new GameStateSchema();

  expect(state.currentVotingOptions).toBeInstanceOf(ArraySchema);
  expect([...state.currentVotingOptions]).toEqual([]);
  expect(state.selectedCategory).toBe("");
});

test("should allow setting phase", () => {
  const state = new GameStateSchema();
  state.phase = "playing";
  expect(state.phase).toBe("playing");
});

test("should allow setting roomCode", () => {
  const state = new GameStateSchema();
  state.roomCode = "ABC123";
  expect(state.roomCode).toBe("ABC123");
});

test("should allow setting selectedCategory", () => {
  const state = new GameStateSchema();
  state.selectedCategory = "Movies";
  expect(state.selectedCategory).toBe("Movies");
});

test("should have players map", () => {
  const state = new GameStateSchema();
  expect(state.players).toBeInstanceOf(MapSchema);
});
