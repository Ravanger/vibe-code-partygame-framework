import { describe, expect, it } from "vitest";
import { ACTION_LOG, getActionLog } from "../src/index.js";

describe("getActionLog", () => {
  it("returns undefined when no log has been recorded", () => {
    expect(getActionLog({ secret: "s" })).toBeUndefined();
  });

  it("returns the stored log under the ACTION_LOG key, stable across calls", () => {
    const priv: Record<string, unknown> = { secret: "s" };
    const log = { header: { seed: 1, game: "G", startedAt: 0 }, entries: [] as unknown[] };
    priv[ACTION_LOG] = log;
    expect(getActionLog(priv)).toBe(log);
    expect(getActionLog(priv)).toBe(log);
  });
});
