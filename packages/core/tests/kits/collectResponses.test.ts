import { describe, expect, it } from "vitest";
import { allResponded, dropLeavers, entriesFor } from "../../src/kits/collectResponses.js";

describe("entriesFor", () => {
  const slots = new Map([
    ["a", ["s1", "s2"]],
    ["b", ["s1"]],
  ]);
  const responses = new Map([
    ["a", new Map([["s1", "hi"]])],
    ["b", new Map([["s1", "yo"]])],
  ]);

  it("lists the authors of a slot with their text or lack of it", () => {
    expect(entriesFor("s1", slots, responses)).toEqual([
      { playerId: "a", text: "hi" },
      { playerId: "b", text: "yo" },
    ]);
    expect(entriesFor("s2", slots, responses)).toEqual([{ playerId: "a", text: undefined }]);
  });
});

describe("allResponded", () => {
  const slots = new Map([
    ["a", ["s1", "s2"]],
    ["b", ["s1"]],
  ]);
  const responses = new Map([
    ["a", new Map([["s1", "hi"]])],
    ["b", new Map([["s1", "yo"]])],
  ]);

  it("is complete only when every slot has a response", () => {
    const present = new Set(["a", "b"]);
    expect(allResponded(slots, responses, present)).toBe(false);
    responses.get("a")?.set("s2", "late");
    expect(allResponded(slots, responses, present)).toBe(true);
    expect(allResponded(new Map(), new Map(), present)).toBe(false);
  });

  it("does not wait for absent authors, and never completes with nobody present", () => {
    const pending = new Map([["a", new Map([["s1", "hi"]])]]);
    expect(allResponded(slots, pending, new Set(["a"]))).toBe(false);
    expect(allResponded(slots, pending, new Set(["b"]))).toBe(false);
    expect(allResponded(new Map([["b", ["s1"]]]), responses, new Set(["a", "b"]))).toBe(true);
    expect(allResponded(slots, responses, new Set(["c"]))).toBe(false);
    expect(allResponded(slots, responses, new Set())).toBe(false);
  });

  it("is not complete when a present author has no responses at all", () => {
    expect(allResponded(new Map([["a", ["s1"]]]), new Map(), new Set(["a"]))).toBe(false);
  });
});

describe("dropLeavers", () => {
  it("removes the entries of players who are not present, keeps the rest", () => {
    const slots = new Map([
      ["a", ["s1"]],
      ["b", ["s2"]],
      ["c", ["s3"]],
    ]);
    const responses = new Map([
      ["a", new Map([["s1", "hi"]])],
      ["b", new Map([["s2", "yo"]])],
      ["c", new Map([["s3", "zz"]])],
    ]);
    dropLeavers(slots, responses, new Set(["a", "c"]));
    expect([...slots.keys()]).toEqual(["a", "c"]);
    expect([...responses.keys()]).toEqual(["a", "c"]);
  });

  it("removes a leaver even when they never responded", () => {
    const slots = new Map([
      ["a", ["s1"]],
      ["b", ["s2"]],
    ]);
    const responses = new Map([["a", new Map([["s1", "hi"]])]]);
    dropLeavers(slots, responses, new Set(["a"]));
    expect([...slots.keys()]).toEqual(["a"]);
    expect(responses.has("b")).toBe(false);
  });

  it("is a no-op on empty maps", () => {
    const slots = new Map<string, string[]>();
    const responses = new Map<string, Map<string, string>>();
    dropLeavers(slots, responses, new Set());
    expect(slots.size).toBe(0);
    expect(responses.size).toBe(0);
  });
});
