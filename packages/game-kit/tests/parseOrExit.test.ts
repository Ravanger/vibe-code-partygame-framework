import { describe, expect, it } from "vitest";
import { parseOrExit } from "../src/parseOrExit.js";
import { fakeIo } from "./fixtures/fakeIo.js";

describe("parseOrExit", () => {
  it("returns the parsed value when parsing succeeds", () => {
    const { io, err, exits } = fakeIo([]);
    expect(parseOrExit<{ bots: number }>(io, () => ({ ok: true, value: { bots: 2 } }))).toEqual({
      bots: 2,
    });
    expect(err).toEqual([]);
    expect(exits).toEqual([]);
  });

  it("prints the error, exits 2 and returns undefined when parsing fails", () => {
    const { io, err, exits } = fakeIo([]);
    expect(
      parseOrExit<{ bots: number }>(io, () => ({ ok: false, error: "bad args" })),
    ).toBeUndefined();
    expect(err).toEqual(["bad args"]);
    expect(exits).toEqual([2]);
  });
});
