import { ArraySchema, MapSchema } from "@colyseus/schema";
import { expect, test } from "vitest";
import { GameStateSchema } from "../src/schema/GameStateSchema";

test("should instantiate with defaults", () => {
  const state = new GameStateSchema();
  expect(state.phase).toBe("Lobby");
  expect(state.publicData).toBe("{}");
  expect(state.roomCode).toBe("");
  expect(state.selectedCategory).toBe("");
});

test("should have currentVotingOptions as ArraySchema", () => {
  const state = new GameStateSchema();
  expect(state.currentVotingOptions).toBeInstanceOf(ArraySchema);
  expect([...state.currentVotingOptions]).toEqual([]);
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

test("should allow setting publicData", () => {
  const state = new GameStateSchema();
  state.publicData = '{"score": 100}';
  expect(state.publicData).toBe('{"score": 100}');
});

test("should allow adding to currentVotingOptions", () => {
  const state = new GameStateSchema();
  state.currentVotingOptions.push("option1");
  expect([...state.currentVotingOptions]).toContain("option1");
});
