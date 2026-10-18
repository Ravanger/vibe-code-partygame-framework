import { describe, expect, it } from "vitest";
import { createTextFilter } from "../src/filter.js";

const filter = createTextFilter();

describe("createTextFilter", () => {
  it("passes clean text at every level", () => {
    for (const level of ["off", "moderate", "strict"] as const) {
      expect(filter.check("hello world", level)).toEqual({ ok: true });
      // "class" and "assessment" contain the letters of mild terms but are clean.
      expect(filter.check("what a class act, the assessment is done", level)).toEqual({ ok: true });
    }
  });

  it("fails a slur at moderate and strict", () => {
    for (const level of ["moderate", "strict"] as const) {
      expect(filter.check("you nigger", level).ok).toBe(false);
    }
  });

  it("fails common profanity at moderate and strict", () => {
    for (const level of ["moderate", "strict"] as const) {
      expect(filter.check("what the fuck", level).ok).toBe(false);
    }
  });

  it("passes mild terms at moderate but fails them at strict", () => {
    for (const word of ["ass", "bastard", "boob"]) {
      expect(filter.check(`what a ${word}`, "moderate")).toEqual({ ok: true });
      expect(filter.check(`what a ${word}`, "strict").ok).toBe(false);
    }
  });

  it("catches character substitutions such as $ for s", () => {
    expect(filter.check("$hit yourself", "moderate").ok).toBe(false);
  });

  it("always passes at off, even with slurs and profanity", () => {
    expect(filter.check("you nigger, what the fuck", "off")).toEqual({ ok: true });
  });

  it("rejects with a fixed reason per level that never names the matched word", () => {
    const expected: Record<"moderate" | "strict", string> = {
      moderate: "contains inappropriate language",
      strict: "contains strong language",
    };
    for (const level of ["moderate", "strict"] as const) {
      const result = filter.check("you nigger, what the fuck", level);
      expect(result).toEqual({ ok: false, reason: expected[level] });
      if (!result.ok) {
        for (const word of ["nigger", "fuck"]) {
          expect(result.reason).not.toContain(word);
        }
      }
    }
  });
});
