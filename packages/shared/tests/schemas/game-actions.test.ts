import { describe, expect, it } from "vitest";
import { GameActionSchema } from "../../src/schemas/game-actions.js";

describe("GameActionSchema", () => {
  // This is the exact payload Lobby.svelte sends. It currently FAILS.
  it("accepts START_GAME (the payload the client actually sends)", () => {
    expect(GameActionSchema.safeParse({ type: "START_GAME" }).success).toBe(true);
  });

  it("accepts VOTE_CATEGORY with a categoryId", () => {
    expect(
      GameActionSchema.safeParse({ type: "VOTE_CATEGORY", categoryId: "politics" }).success,
    ).toBe(true);
  });

  it("accepts SUBMIT_ANSWER with a matchupId and an answer", () => {
    expect(
      GameActionSchema.safeParse({ type: "SUBMIT_ANSWER", matchupId: "m1", answer: "42" }).success,
    ).toBe(true);
  });

  it("rejects SUBMIT_ANSWER without a matchupId", () => {
    // Each player answers TWO prompts (Plan 08 pairing), so the server must be
    // told WHICH one this answer is for.
    expect(GameActionSchema.safeParse({ type: "SUBMIT_ANSWER", answer: "42" }).success).toBe(false);
  });

  it("accepts CAST_VOTE with an answerId", () => {
    expect(GameActionSchema.safeParse({ type: "CAST_VOTE", answerId: "a1" }).success).toBe(true);
  });

  it("accepts PLAY_AGAIN", () => {
    expect(GameActionSchema.safeParse({ type: "PLAY_AGAIN" }).success).toBe(true);
  });

  it("rejects an unknown action type", () => {
    expect(GameActionSchema.safeParse({ type: "NOPE" }).success).toBe(false);
  });

  it("rejects VOTE_CATEGORY with an empty categoryId", () => {
    expect(GameActionSchema.safeParse({ type: "VOTE_CATEGORY", categoryId: "" }).success).toBe(
      false,
    );
  });

  it("rejects SUBMIT_ANSWER with an over-long answer", () => {
    const answer = "x".repeat(201);
    expect(
      GameActionSchema.safeParse({ type: "SUBMIT_ANSWER", matchupId: "m1", answer }).success,
    ).toBe(false);
  });
});
