import { describe, expect, it } from "vitest";
import { PlayerNameSchema, SetNameSchema } from "../../src/schemas/player";

describe("SetNameSchema", () => {
  it("trims and accepts a normal name", () => {
    expect(SetNameSchema.parse("  Ada  ")).toBe("Ada");
  });
  it("rejects an empty name", () => {
    expect(SetNameSchema.safeParse("   ").success).toBe(false);
  });
  it("rejects a name over 20 characters", () => {
    expect(SetNameSchema.safeParse("x".repeat(21)).success).toBe(false);
  });
});

describe("PlayerNameSchema", () => {
  it("should validate a valid player name", () => {
    expect(PlayerNameSchema.safeParse("Alice").success).toBe(true);
  });

  it("should reject a player name that is too short", () => {
    expect(PlayerNameSchema.safeParse("A").success).toBe(false);
  });

  it("should reject an empty player name", () => {
    expect(PlayerNameSchema.safeParse("").success).toBe(false);
  });

  it("should reject a player name that is too long", () => {
    expect(PlayerNameSchema.safeParse("a".repeat(21)).success).toBe(false);
  });
});
