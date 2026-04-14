import { describe, it, expect } from "vitest";

describe("Server Entry Point", () => {
  it("should be importable", () => {
    // Just verifying that importing the entry point doesn't throw
    expect(async () => import("../src/index.js")).not.toThrow();
  });
});
