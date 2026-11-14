import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditReducedMotion } from "../testing.js";

const dirs: string[] = [];

/** A throwaway ui/ directory; files are written relative to it. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "game-ui-motion-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("auditReducedMotion", () => {
  it("flags scroll-behavior: smooth outside a no-preference block and counts the guarded ones", () => {
    const uiDir = fixture({
      "app.css": `
        .page { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: no-preference) {
          .panel { scroll-behavior: smooth; transition: opacity 0.3s ease; }
        }
      `,
    });
    const report = auditReducedMotion({ uiDir, minGuarded: 2 });
    expect(report.guarded).toBe(2);
    expect(report.directives).toEqual([]);
    expect(report.unguarded).toHaveLength(1);
    expect(report.unguarded[0]).toMatch(/app\.css \.page: scroll-behavior/);
  });

  it("keeps the exemption for a value of exactly none", () => {
    const uiDir = fixture({
      "app.css": `
        .still { transition: none; animation: none; }
        @media (prefers-reduced-motion: no-preference) {
          .panel { transition: transform 0.2s ease; }
        }
      `,
    });
    const report = auditReducedMotion({ uiDir, minGuarded: 1 });
    expect(report.unguarded).toEqual([]);
  });

  it("flags transitions and animations that sit outside any no-preference block", () => {
    const uiDir = fixture({
      "app.css": `
        .card { transition: opacity 0.3s ease; animation: pop 1s linear; }
      `,
    });
    const report = auditReducedMotion({ uiDir, minGuarded: 0 });
    expect(report.guarded).toBe(0);
    expect(report.unguarded).toHaveLength(2);
    expect(report.unguarded.join("\n")).toMatch(/\.card: transition/);
    expect(report.unguarded.join("\n")).toMatch(/\.card: animation/);
  });

  it("scans .svelte markup for motion directives and honours the allow list", () => {
    const uiDir = fixture({
      "App.svelte": `<script lang="ts">\nconst t = "transition:slide";\n</script>\n\n<div in:fade={{ delay: 100 }} out:fade>hi</div>`,
      "Calm.svelte": `<div transition:slide={undefined}>calm</div>`,
      "styles.css": `@media (prefers-reduced-motion: no-preference) {\n  .x { transition: opacity 1s; }\n}`,
    });
    const flagged = auditReducedMotion({ uiDir, minGuarded: 1 });
    expect(flagged.directives).toEqual(["App.svelte", "Calm.svelte"]);
    const allowed = auditReducedMotion({ uiDir, minGuarded: 1, allow: ["Calm.svelte"] });
    expect(allowed.directives).toEqual(["App.svelte"]);
  });

  it("throws when fewer than minGuarded declarations are guarded", () => {
    const uiDir = fixture({ "app.css": `.still { transition: none; }` });
    expect(() => auditReducedMotion({ uiDir, minGuarded: 1 })).toThrow(
      /guarded 0 declarations, fewer than the minimum of 1/,
    );
  });
});
