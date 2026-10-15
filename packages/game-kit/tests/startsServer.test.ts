import { describe, expect, it } from "vitest";
import { startsServer } from "../src/startsServer.js";

describe("startsServer", () => {
  it("starts a local server when the defaults are used and no room is joined", () => {
    expect(startsServer({ usesDefaults: true, join: undefined })).toBe(true);
  });

  it("does not start a server when joining a room", () => {
    expect(startsServer({ usesDefaults: true, join: "ABCD" })).toBe(false);
  });

  it("does not start a server for a non-default endpoint or port", () => {
    expect(startsServer({ usesDefaults: false, join: undefined })).toBe(false);
  });
});
