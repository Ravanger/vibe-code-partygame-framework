import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { Timer } from "../../src/components/index.js";
import { expectNoViolations } from "../support/a11y.js";

describe("Timer", () => {
  const LENGTH = 92;
  const START = 6;

  function tip(container: HTMLElement): number {
    return Number(container.querySelector(".stick")?.getAttribute("x2"));
  }

  it("shows the seconds and burns the stick down in proportion", async () => {
    const full = render(Timer, { seconds: 30, total: 30 });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(tip(full.container)).toBeCloseTo(START + LENGTH);
    const half = render(Timer, { seconds: 15, total: 30 });
    expect(tip(half.container)).toBeCloseTo(START + LENGTH / 2);
    await expectNoViolations(full.container, "Timer");
  });

  it("stays on the stick, and is burnt out without a total", async () => {
    const over = render(Timer, { seconds: 50, total: 30 });
    expect(tip(over.container)).toBeCloseTo(START + LENGTH);
    const under = render(Timer, { seconds: -2, total: 30 });
    expect(tip(under.container)).toBeCloseTo(START);
    const none = render(Timer, { seconds: 5, total: 0 });
    expect(tip(none.container)).toBeCloseTo(START);
    await expectNoViolations(over.container, "Timer");
  });

  it("turns urgent at ten seconds, but not at zero", async () => {
    const calm = render(Timer, { seconds: 11, total: 30 });
    expect(calm.container.querySelector(".sparkler")).not.toHaveClass("urgent");
    const urgent = render(Timer, { seconds: 10, total: 30 });
    expect(urgent.container.querySelector(".sparkler")).toHaveClass("urgent");
    const zero = render(Timer, { seconds: 0, total: 30 });
    expect(zero.container.querySelector(".sparkler")).not.toHaveClass("urgent");
    await expectNoViolations(urgent.container, "Timer");
  });

  it("hides the number from screen readers; the live region announces it", async () => {
    const { container } = render(Timer, { seconds: 10, total: 30, announcement: "10 left" });
    expect(container.querySelector(".number")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("10 left")).toHaveClass("sr-only");
    await expectNoViolations(container, "Timer");
  });

  it("does not animate the stick with the dead x2 property", () => {
    render(Timer, { seconds: 10, total: 30 });
    const styleRules = (rules: CSSRuleList): CSSStyleRule[] => {
      const out: CSSStyleRule[] = [];
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) out.push(...styleRules(rule.cssRules));
        else if (rule instanceof CSSStyleRule) out.push(rule);
      }
      return out;
    };
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return styleRules(sheet.cssRules);
      } catch {
        return [];
      }
    });
    expect(rules.some((rule) => rule.cssText.includes("transition: x2"))).toBe(false);
  });

  it("announces politely", async () => {
    const { container } = render(Timer, {
      seconds: 10,
      total: 30,
      announcement: "10 seconds remaining",
    });
    const live = container.querySelector("[aria-live='polite']");
    expect(live).toHaveTextContent("10 seconds remaining");
    expect(live).toHaveClass("sr-only");
    await expectNoViolations(container, "Timer");
  });

  it("announces nothing by default", async () => {
    const { container } = render(Timer, { seconds: 10, total: 30 });
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("");
    await expectNoViolations(container, "Timer");
  });
});
