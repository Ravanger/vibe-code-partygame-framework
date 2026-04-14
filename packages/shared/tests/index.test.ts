import { describe, it, expect } from "vitest";
import * as shared from "../src/index.js";

describe("Shared Index", () => {
  it("should export schemas", () => {
    expect(shared).toBeDefined();
  });
});
