import { describe, expect, it } from "vitest";
import { nextId } from "../../src/components/uniqueId.js";

describe("nextId", () => {
  it("builds a per-instance id with a strictly increasing numeric suffix", () => {
    const first = nextId("playerName");
    const second = nextId("playerName");
    expect(first).toMatch(/^playerName-\d+$/);
    expect(second).toMatch(/^playerName-\d+$/);
    const suffix = (id: string): number => Number(id.slice("playerName-".length));
    expect(suffix(second)).toBeGreaterThan(suffix(first));
  });
});
