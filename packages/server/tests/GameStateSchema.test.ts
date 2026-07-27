import { MapSchema } from "@colyseus/schema";
import { describe, expect, it, test } from "vitest";
import { CategoryOptionSchema } from "../src/schema/CategoryOptionSchema";
import { GameStateSchema } from "../src/schema/GameStateSchema";
import { PlayerSchema } from "../src/schema/PlayerSchema";

describe("GameStateSchema serialisation", () => {
  it("registers field metadata (guards against a stubbed @type decorator)", () => {
    const state = new GameStateSchema();
    // Symbol.metadata is populated only by the real decorator.
    expect(Object.getPrototypeOf(state).constructor[Symbol.metadata]).toBeDefined();
  });

  it("stores and retrieves a player round-trip", () => {
    const state = new GameStateSchema();
    const p = new PlayerSchema();
    p.id = "abc";
    p.name = "Ada";
    p.role = "host";
    state.players.set("abc", p);
    expect(state.players.get("abc")?.name).toBe("Ada");
    expect(state.players.size).toBe(1);
  });
});

test("should instantiate with defaults", () => {
  const state = new GameStateSchema();
  expect(state.phase).toBe("Lobby");
  expect(state.publicData).toBe("{}");
  expect(state.roomCode).toBe("");
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

test("should allow setting publicData", () => {
  const state = new GameStateSchema();
  state.publicData = '{"score": 100}';
  expect(state.publicData).toBe('{"score": 100}');
});

describe("Plan 07: category voting fields", () => {
  test("defaults are empty/zero", () => {
    const state = new GameStateSchema();
    expect(state.categoryOptions.length).toBe(0);
    expect(state.categoryVotes.size).toBe(0);
    expect(state.phaseEndsAt).toBe(0);
    expect(state.serverNow).toBe(0);
  });

  test("categoryOptions accepts CategoryOptionSchema", () => {
    const state = new GameStateSchema();
    const opt = new CategoryOptionSchema();
    opt.id = "alpha";
    opt.name = "Alpha";
    opt.emoji = "🅰️";
    opt.votes = 0;
    state.categoryOptions.push(opt);
    expect(state.categoryOptions.length).toBe(1);
    expect(state.categoryOptions[0]?.id).toBe("alpha");
  });

  test("categoryVotes stores sessionId -> categoryId", () => {
    const state = new GameStateSchema();
    state.categoryVotes.set("session-1", "alpha");
    expect(state.categoryVotes.size).toBe(1);
    expect(state.categoryVotes.get("session-1")).toBe("alpha");
  });

  test("CategoryOptionSchema persists fields correctly", () => {
    const state = new GameStateSchema();
    const opt = new CategoryOptionSchema();
    opt.id = "alpha";
    opt.name = "Alpha";
    opt.emoji = "🅰️";
    opt.votes = 3;
    state.categoryOptions.push(opt);

    expect(state.categoryOptions.length).toBe(1);
    expect(state.categoryOptions[0]?.id).toBe("alpha");
    expect(state.categoryOptions[0]?.name).toBe("Alpha");
    expect(state.categoryOptions[0]?.emoji).toBe("🅰️");
    expect(state.categoryOptions[0]?.votes).toBe(3);
  });
});
