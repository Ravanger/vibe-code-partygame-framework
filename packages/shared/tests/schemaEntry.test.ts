import { describe, expect, it } from "vitest";
import * as entry from "../src/schema/index.js";

describe("@partygame/shared/schema", () => {
  it("exports the base schemas", () => {
    expect(Object.keys(entry).sort()).toEqual(["BaseGameState", "PlayerSchema"]);
  });
});
