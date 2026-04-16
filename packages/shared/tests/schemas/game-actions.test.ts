import { describe, expect, it } from "vitest";
import { GameActionSchema } from "../../src/schemas/game-actions.js";

describe("GameActionSchema", () => {
  it("should validate valid StartGame action", () => {
    const result = GameActionSchema.safeParse({ type: "StartGame" });
    expect(result.success).toBe(true);
  });

  it("should validate valid SubmitAnswer action", () => {
    const result = GameActionSchema.safeParse({ type: "SubmitAnswer", answer: "Hello" });
    expect(result.success).toBe(true);
  });

  it("should validate valid CastVote action", () => {
    const result = GameActionSchema.safeParse({ type: "CastVote", answerId: "123" });
    expect(result.success).toBe(true);
  });

  it("should validate valid AcknowledgeReveal action", () => {
    const result = GameActionSchema.safeParse({ type: "AcknowledgeReveal" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid action type", () => {
    const result = GameActionSchema.safeParse({ type: "InvalidType" });
    expect(result.success).toBe(false);
  });
});
