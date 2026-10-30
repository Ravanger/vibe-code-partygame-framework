import { describe, expect, it } from "vitest";
import { cssFiles, rules } from "./helpers/css.js";

/** True when an enclosing @media opts into motion (the user does not request reduced motion). */
const allowsMotion = (media: string[]): boolean =>
  media.some((condition) => /prefers-reduced-motion:\s*no-preference/.test(condition));

describe("reduced motion", () => {
  it("keeps every transition and animation inside a no-preference block", () => {
    const unguarded: string[] = [];
    let guarded = 0;
    for (const { file, css } of cssFiles()) {
      for (const rule of rules(css)) {
        // a value of "none" disables motion, so it is safe in any media block
        const names = Object.keys(rule.decls).filter(
          (name) => /^(transition|animation)/.test(name) && rule.decls[name] !== "none",
        );
        if (names.length === 0) continue;
        if (allowsMotion(rule.media)) {
          guarded += names.length;
          continue;
        }
        for (const name of names) unguarded.push(`${file} ${rule.selector}: ${name}`);
      }
    }
    // The suite only means something while the UI still animates.
    expect(guarded).toBeGreaterThan(0);
    expect(unguarded).toEqual([]);
  });
});
