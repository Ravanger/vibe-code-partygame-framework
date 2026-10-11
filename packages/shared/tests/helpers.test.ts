import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, SetNameSchema } from "../src/index.js";

describe("NAME_MAX_LENGTH", () => {
  it("is the limit SET_NAME enforces", () => {
    expect(SetNameSchema.safeParse("x".repeat(NAME_MAX_LENGTH)).success).toBe(true);
    expect(SetNameSchema.safeParse("x".repeat(NAME_MAX_LENGTH + 1)).success).toBe(false);
  });
});
