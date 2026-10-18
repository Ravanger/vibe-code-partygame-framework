import { describe, expect, it } from "vitest";
import { drawPool } from "../../src/kits/drawPool.js";

describe("drawPool", () => {
  const items = ["p1", "p2", "p3", "p4"].map((id) => ({ id }));

  it("offers only the unused items while enough remain", () => {
    const usedIds = new Set(["p1"]);
    expect(drawPool(items, usedIds, 3)).toEqual({ items: items.slice(1), exhausted: false });
    expect([...usedIds]).toEqual(["p1"]);
  });

  it("falls back to all items and clears their ids when too few are left", () => {
    const usedIds = new Set(["p1", "p2"]);
    expect(drawPool(items, usedIds, 3)).toEqual({ items, exhausted: true });
    expect(usedIds.size).toBe(0);
  });

  it("never exhausts when nothing is needed", () => {
    const usedIds = new Set(["p1", "p2", "p3", "p4"]);
    expect(drawPool(items, usedIds, 0)).toEqual({ items: [], exhausted: false });
  });

  it("exhausts on an empty pool", () => {
    const usedIds = new Set<string>();
    expect(drawPool([], usedIds, 1)).toEqual({ items: [], exhausted: true });
  });
});
