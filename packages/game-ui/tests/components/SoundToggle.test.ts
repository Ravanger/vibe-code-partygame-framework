import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { SoundToggle } from "../../src/components/index.js";
import { SoundPolicy, type SoundStorage } from "../../src/SoundPolicy.svelte.js";
import { setStrings } from "../../src/strings.js";

const memoryStorage = (): SoundStorage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
};

const policy = () =>
  new SoundPolicy({ storage: memoryStorage(), storagePrefix: "g", target: window });

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

afterEach(() => setStrings({}));

describe("SoundToggle", () => {
  it("is a native button (keyboard operable) with aria-pressed and the constant label", () => {
    render(SoundToggle, { policy: policy() });
    const button = screen.getByRole("button");
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.textContent).toBe("Sound");
  });

  it("toggles the policy; only aria-pressed changes, the label stays constant", () => {
    const p = policy();
    render(SoundToggle, { policy: p });
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(p.enabled).toBe(true);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.textContent).toBe("Sound");
    fireEvent.click(button);
    expect(p.enabled).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.textContent).toBe("Sound");
  });

  it("takes its label from the UiStrings table", () => {
    setStrings({ sound: "Ton" });
    render(SoundToggle, { policy: policy() });
    expect(screen.getByRole("button").textContent).toBe("Ton");
  });

  it("gives the button a 44px minimum height", () => {
    render(SoundToggle, { policy: policy() });
    expect(ruleCss(/(^|\s)button/)).toContain("min-height: 44px");
  });
});
