import { describe, expect, it } from "vitest";
import { isGameOver } from "../../src/isGameOver.js";
import { Table } from "./support.js";

describe("isGameOver", () => {
  it("is false while the race runs and true on the results screen", () => {
    const t = Table.started({ options: { raceSeconds: 5 } });
    expect(isGameOver(t.state)).toBe(false);
    t.tick(5000);
    expect(isGameOver(t.state)).toBe(true);
  });
});
