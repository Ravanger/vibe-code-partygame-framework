import { describe, expect, it } from "vitest";
import { deriveNames, parseSlug } from "../src/slug.js";

describe("parseSlug", () => {
  it.each([["my-game"], ["a"], ["x2-y3"]])("accepts a valid slug: %s", (slug) => {
    expect(parseSlug(slug)).toEqual({ ok: true, slug });
  });

  it.each([
    [""],
    ["My-Game"], // uppercase
    ["my game"], // spaces
    ["-leading"], // leading dash
    ["2fast"], // leading digit would derive an invalid identifier
    ["_under"], // leading underscore
    ["trailing-"], // trailing dash
    ["double--dash"], // double dash
    ["list"], // reserved
    ["launch"], // reserved
    ["play"], // reserved
    ["bots"], // reserved
    ["dev"], // reserved
    ["host"], // reserved
    ["prod"], // reserved
  ])("rejects %j", (input) => {
    const result = parseSlug(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toBe("");
  });

  it("rejects a non-string", () => {
    for (const input of [undefined, null, 42, {}] as const) {
      const result = parseSlug(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).not.toBe("");
    }
  });
});

describe("deriveNames", () => {
  it("derives all five names from a multi-word slug", () => {
    expect(deriveNames("my-game")).toEqual({
      slug: "my-game",
      pascalName: "MyGame",
      camelName: "myGame",
      displayName: "My Game",
      roomName: "my_game",
    });
  });

  it("handles a single word", () => {
    expect(deriveNames("wave")).toEqual({
      slug: "wave",
      pascalName: "Wave",
      camelName: "wave",
      displayName: "Wave",
      roomName: "wave",
    });
  });

  it("capitalizes the first letter of each word, keeping digits", () => {
    expect(deriveNames("x2-y3")).toEqual({
      slug: "x2-y3",
      pascalName: "X2Y3",
      camelName: "x2Y3",
      displayName: "X2 Y3",
      roomName: "x2_y3",
    });
  });
});
