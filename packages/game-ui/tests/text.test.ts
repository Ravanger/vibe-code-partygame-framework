import { describe, expect, it } from "vitest";
import { plural } from "../src/text.js";

describe("plural", () => {
  it("uses the singular for one", () => {
    expect(plural(1, "vote")).toBe("vote");
  });

  it("appends s for zero and everything else", () => {
    expect(plural(0, "vote")).toBe("votes");
    expect(plural(2, "vote")).toBe("votes");
    expect(plural(17, "vote")).toBe("votes");
  });

  it("uses the custom plural when given", () => {
    expect(plural(2, "child", "children")).toBe("children");
    expect(plural(0, "child", "children")).toBe("children");
  });

  it("keeps the singular for one even with a custom plural", () => {
    expect(plural(1, "child", "children")).toBe("child");
  });
});
