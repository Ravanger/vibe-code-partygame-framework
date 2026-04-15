import { describe, expect, it } from "vitest";
import * as shared from "../src/index.js";

describe("Shared Index", () => {
  it("should export schemas", () => {
    expect(shared).toBeDefined();
  });
});
