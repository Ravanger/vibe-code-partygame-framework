import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditReducedMotion } from "@partygame/game-ui/testing";
import { describe, expect, it } from "vitest";

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ui");

describe("reduced motion", () => {
  it("keeps every transition and animation inside a no-preference block", () => {
    const report = auditReducedMotion({ uiDir: UI_DIR, minGuarded: 13 });
    expect(report.unguarded).toEqual([]);
    expect(report.directives).toEqual([]);
  });
});
