// @ts-nocheck
import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { META } from "../../src/meta.js";
import { __PascalName__State } from "../../src/state.js";

describe("gamePackage", () => {
  it("describes the wave game for a server to host", () => {
    expect(gamePackage.meta).toBe(META);
    expect(gamePackage.stateClass).toBe(__PascalName__State);
    expect(gamePackage.definition(undefined).name).toBe(__DisplayNameJson__);
  });
});
