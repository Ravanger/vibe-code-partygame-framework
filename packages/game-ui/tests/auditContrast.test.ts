import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditContrast } from "../testing.js";

const dirs: string[] = [];

/** A throwaway ui/ directory with one stylesheet. */
function fixture(css: string): string {
  const dir = mkdtempSync(join(tmpdir(), "game-ui-contrast-"));
  dirs.push(dir);
  writeFileSync(join(dir, "app.css"), css);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("auditContrast", () => {
  it("fails on a colour or background variable that is defined nowhere", () => {
    const uiDir = fixture(`
      :root {
        --good: #ffffff;
        --bg: #000000;
      }
      .ok { color: var(--good); background: var(--bg); font-size: 1rem; }
      .broken { color: var(--pink); background: var(--paper2); font-size: 1rem; }
    `);
    const report = auditContrast({ uiDir, minChecked: 1 });
    expect(report.checked).toBe(1);
    expect(report.failures).toEqual([]);
    expect(report.unresolved).toHaveLength(2);
    expect(report.unresolved.join("\n")).toMatch(/app\.css \.broken: color var\(--pink\)/);
    expect(report.unresolved.join("\n")).toMatch(/background var\(--paper2\)/);
  });

  it("fails a large-text-only pair whose size is not statically resolvable, and passes it at 24px", () => {
    const uiDir = fixture(`
      .small { color: #ffffff; background: #f04f9a; }
      .large { color: #ffffff; background: #f04f9a; font-size: 1.5rem; }
    `);
    const report = auditContrast({ uiDir, minChecked: 2 });
    expect(report.checked).toBe(2);
    expect(report.unresolved).toEqual([]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/\.small/);
    expect(report.failures[0]).toMatch(/needs 4\.5:1/);
  });

  it("passes a bold pair at the 18.66px large-text threshold", () => {
    const uiDir = fixture(`
      .bold { color: #ffffff; background: #f04f9a; font-size: 1.2rem; font-weight: 700; }
    `);
    const report = auditContrast({ uiDir, minChecked: 1 });
    expect(report.failures).toEqual([]);
  });

  it("throws when fewer than minChecked pairs were checked", () => {
    const uiDir = fixture(`.static { color: #ffffff; }`);
    expect(() => auditContrast({ uiDir, minChecked: 1 })).toThrow(
      /checked 0 pairs, fewer than the minimum of 1/,
    );
  });

  it("checks explicit cross-rule pairs without counting them toward minChecked", () => {
    const uiDir = fixture(`
      .fg { color: #ffffff; }
      .bg { background: #000000; }
      .pink-bg { background: #f04f9a; }
      .ok { color: #111111; background: #ffffff; }
    `);
    const report = auditContrast({
      uiDir,
      minChecked: 1,
      pairs: [
        { color: ".fg", background: ".bg" },
        { color: ".fg", background: ".pink-bg" },
      ],
    });
    expect(report.checked).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/pair \.fg on \.pink-bg/);
  });

  it("fails an explicit pair whose rule cannot be resolved", () => {
    const uiDir = fixture(`
      .ok { color: #111111; background: #ffffff; }
      .bg { background: #000000; }
    `);
    const report = auditContrast({
      uiDir,
      minChecked: 1,
      pairs: [
        { color: ".missing", background: ".bg" },
        { color: ".ok", background: ".also-missing" },
      ],
    });
    expect(report.failures).toHaveLength(2);
    expect(report.failures[0]).toMatch(/pair \.missing: no rule with a resolvable colour/);
    expect(report.failures[1]).toMatch(/pair \.also-missing: no rule with a resolvable background/);
  });

  it("exempts disabled components and skips non-colour backgrounds", () => {
    const uiDir = fixture(`
      .btn:disabled { color: #ffffff; background: #f04f9a; }
      .paper { background-image: url(grain.png); color: #111111; background-color: #ffffff; }
    `);
    const report = auditContrast({ uiDir, minChecked: 1 });
    expect(report.checked).toBe(1);
    expect(report.failures).toEqual([]);
  });
});
