import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditContrast } from "@partygame/game-ui/testing";
import { describe, expect, it } from "vitest";

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ui");

describe("text contrast (WCAG AA)", () => {
  it("meets the required ratio for every colour pair in ui/", () => {
    const report = auditContrast({ uiDir: UI_DIR, minChecked: 14 });
    expect(report.unresolved).toEqual([]);
    expect(report.failures).toEqual([]);
  });
});
