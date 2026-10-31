import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CssRule, cssFiles, rules, stripComments } from "./helpers/css.js";

/** The game-ui theme contract that app.css imports first; :root overrides in ui/ win over it. */
const CONTRACT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages/game-ui/theme-contract.css",
);

type Tokens = Record<string, string>;

/** The custom properties of the first :root block, matched by braces so values may contain them. */
function rootVars(css: string): Tokens {
  const plain = stripComments(css);
  const start = plain.indexOf(":root");
  const open = start < 0 ? -1 : plain.indexOf("{", start);
  if (open < 0) return {};
  let depth = 1;
  let close = open + 1;
  while (close < plain.length && depth > 0) {
    if (plain[close] === "{") ++depth;
    else if (plain[close] === "}") --depth;
    ++close;
  }
  const out: Tokens = {};
  for (const line of plain.slice(open + 1, close - 1).split(";")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim();
    if (name.startsWith("--")) out[name] = line.slice(colon + 1).trim();
  }
  return out;
}

function tokens(): Tokens {
  const all: Tokens = { ...rootVars(readFileSync(CONTRACT, "utf8")) };
  for (const { css } of cssFiles()) Object.assign(all, rootVars(css));
  return all;
}

/** Resolve a declaration value to a #rrggbb color; null for anything not statically resolvable. */
function resolveColor(value: string | undefined, tokens: Tokens): string | null {
  if (value === undefined) return null;
  let v = value.trim();
  const varName = /^var\((--[a-z0-9-]+)\)/.exec(v)?.[1];
  if (varName !== undefined) v = (tokens[varName] ?? "").trim();
  const hexValue = /^#([0-9a-f]{6})$/i.exec(v)?.[1];
  if (hexValue !== undefined) return `#${hexValue.toLowerCase()}`;
  const rgb = /^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (rgb !== null && rgb[1] !== undefined && rgb[2] !== undefined && rgb[3] !== undefined) {
    const channel = (n: string): string => Number(n).toString(16).padStart(2, "0");
    return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
  }
  return null; // transparent, url(), gradients, inherit, undefined variables
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(fg: string, bg: string): number {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  if (light === undefined || dark === undefined) return 1;
  return (light + 0.05) / (dark + 0.05);
}

/** The rendered font size in px at the smallest scale the theme allows; null when not statically resolvable. */
function fontSizePx(decls: CssRule["decls"], tokens: Tokens): number | null {
  const value = decls["font-size"];
  if (value === undefined) return null;
  const step = /--fs-(\d+)/.exec(value);
  const raw = step !== null ? (tokens[`--fs-${step[1]}`] ?? "") : value;
  const rem = /([\d.]+)rem/.exec(raw);
  if (rem === null) return null;
  return Number(rem[1]) * 16;
}

const isBold = (weight: string | undefined): boolean =>
  weight !== undefined && /(^|[\s,])(bold|[789]00)(?=[\s,)]|$)/.test(weight);

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text (24px, or 18.66px bold). */
function requiredRatio(rule: CssRule, tokens: Tokens): number {
  const px = fontSizePx(rule.decls, tokens);
  if (px !== null && (px >= 24 || (px >= 18.66 && isBold(rule.decls["font-weight"])))) return 3;
  return 4.5;
}

describe("text contrast (WCAG AA)", () => {
  it("meets the required ratio for every color/background pair set in ui/", () => {
    const all = tokens();
    const failures: string[] = [];
    let checked = 0;
    for (const { file, css } of cssFiles()) {
      for (const rule of rules(css)) {
        // Inactive UI components are exempt from WCAG 1.4.3.
        if (rule.selector.includes(":disabled")) continue;
        const fg = resolveColor(rule.decls.color, all);
        const bg = resolveColor(rule.decls.background ?? rule.decls["background-color"], all);
        if (fg === null || bg === null) continue;
        ++checked;
        const ratio = contrast(fg, bg);
        const need = requiredRatio(rule, all);
        if (ratio < need - 1e-9) {
          failures.push(
            `${file} ${rule.selector}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs ${need}:1)`,
          );
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
