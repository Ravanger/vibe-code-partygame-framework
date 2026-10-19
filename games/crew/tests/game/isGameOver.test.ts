import { describe, expect, it } from "vitest";
import { isGameOver } from "../../src/isGameOver.js";
import { playToVerdict, Table } from "./support.js";

describe("isGameOver", () => {
  it("is false during play and true on the results screen", () => {
    const t = Table.started({ options: { rounds: 1 } });
    expect(isGameOver(t.state)).toBe(false);
    playToVerdict(t);
    t.guess("p1", t.priv.target);
    expect(isGameOver(t.state)).toBe(true);
  });
});
