import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Results from "../../ui/screens/Results.svelte";
import { award, connectedClient, scoreRow } from "../helpers/client.js";

/** The cssText of the first style rule whose selector matches `re`. */
function ruleCss(re: RegExp): string {
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && re.test(rule.selectorText)) return rule.cssText;
    }
  }
  throw new Error(`no style rule matching ${re}`);
}

describe("TV results layout", () => {
  it("lets the stage and board columns fill the viewport height", () => {
    const c = connectedClient({ name: "Ann" }, "Results");
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    c.state.scoreboard.push(
      scoreRow(c.manager.playerId, 500, { name: "Ann", roundPoints: 250 }),
      scoreRow("cy-1234567", 300, { name: "Cy" }),
      scoreRow("bob-1234567", 900, { name: "Bob" }),
    );
    render(Results, { manager: c.manager });
    // stretch: the columns take the full height of the row instead of hugging their content to the top;
    // space-between: the board column spreads its sections across that height at 4k and packs them at 1080p.
    expect(ruleCss(/^main\.tv \.results\.[a-z0-9-]+$/)).toMatch(/align-items:\s*stretch/);
    expect(ruleCss(/^main\.tv \.results\.[a-z0-9-]+ \.board:where\(\.[a-z0-9-]+\)$/)).toMatch(
      /justify-content:\s*space-between/,
    );
  });

  it("lays the awards row out as one grid column per award", () => {
    const c = connectedClient({ name: "Ann" }, "Results");
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    c.state.scoreboard.push(
      scoreRow(c.manager.playerId, 500, { name: "Ann", roundPoints: 250 }),
      scoreRow("cy-1234567", 300, { name: "Cy" }),
      scoreRow("bob-1234567", 900, { name: "Bob" }),
    );
    c.state.awards.push(
      award("a1", "Quickest", ["Ann"]),
      award("a2", "Funniest", ["Cy"]),
      award("honor", "Honor award", ["Bob"]),
    );
    render(Results, { manager: c.manager });
    // The column count comes from the inline --count on the section; without it, var(--count, 1)
    // would silently collapse the row to a single column.
    expect(ruleCss(/^main\.tv \.ceremony\.[a-z0-9-]+$/)).toMatch(
      /grid-template-columns:\s*repeat\(var\(--count,\s*1\),\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(screen.getByLabelText("Awards").style.getPropertyValue("--count")).toBe("3");
  });
});
