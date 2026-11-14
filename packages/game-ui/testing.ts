import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The theme contract every game's app.css imports first; its :root tokens are the baseline. */
const CONTRACT = join(dirname(fileURLToPath(import.meta.url)), "theme-contract.css");

/** A parsed CSS rule: its selector, its declarations and the @media conditions it sits in. */
export interface CssRule {
  selector: string;
  decls: Record<string, string>;
  media: string[];
}

/** Removes CSS comments so they can neither hide declarations nor break the brace walk. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every .css and .svelte (style blocks) file under `uiDir`, comments stripped; files are relative to it. */
export function cssFiles(uiDir: string): Array<{ file: string; css: string }> {
  const out: Array<{ file: string; css: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(css|svelte)$/.test(entry.name)) continue;
      const text = readFileSync(path, "utf8");
      const raw = entry.name.endsWith(".svelte")
        ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
        : text;
      const css = stripComments(raw);
      if (css.trim() !== "") out.push({ file: path.slice(uiDir.length + 1), css });
    }
  };
  walk(uiDir);
  return out;
}

/** The top-level rules of a stylesheet, with the @media conditions they sit in. */
export function rules(css: string): CssRule[] {
  const out: CssRule[] = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace < 0) break;
    const pre = css.slice(i, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") ++depth;
      else if (css[j] === "}") --depth;
      ++j;
    }
    const body = css.slice(brace + 1, j - 1);
    i = j;
    const condition = /^@media\s+(.+)$/.exec(pre)?.[1]?.trim();
    if (condition !== undefined) {
      for (const rule of rules(body)) out.push({ ...rule, media: [...rule.media, condition] });
      continue;
    }
    if (pre.startsWith("@") || pre === "") continue;
    const decls: Record<string, string> = {};
    for (const line of body.split(";")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const name = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (name !== "" && !(name in decls)) decls[name] = value;
    }
    out.push({ selector: pre, decls, media: [] });
  }
  return out;
}

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

/** The contract's tokens plus every :root block under the audited ui/; later files win. */
function tokens(files: Array<{ css: string }>): Tokens {
  const all: Tokens = rootVars(readFileSync(CONTRACT, "utf8"));
  for (const { css } of files) Object.assign(all, rootVars(css));
  return all;
}

/** A colour declaration resolved as far as the tokens allow. */
interface ColorResolution {
  /** The #rrggbb value, or null when not statically resolvable. */
  hex: string | null;
  /** The custom property the declaration names that is defined nowhere, if any. */
  missing?: string;
}

/** Resolve a colour declaration to #rrggbb; names an undefined variable as `missing`. */
function resolveColor(value: string | undefined, tokenTable: Tokens): ColorResolution {
  if (value === undefined) return { hex: null };
  let v = value.trim();
  for (let depth = 0; depth < 8; ++depth) {
    const name = /^var\((--[a-z0-9-]+)\)$/.exec(v)?.[1];
    if (name === undefined) break;
    const token = tokenTable[name];
    if (token === undefined) return { hex: null, missing: name };
    v = token.trim();
  }
  const hexValue = /^#([0-9a-f]{6})$/i.exec(v)?.[1];
  if (hexValue !== undefined) return { hex: `#${hexValue.toLowerCase()}` };
  const rgb = /^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (rgb !== null && rgb[1] !== undefined && rgb[2] !== undefined && rgb[3] !== undefined) {
    const channel = (n: string): string => Number(n).toString(16).padStart(2, "0");
    return { hex: `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}` };
  }
  return { hex: null }; // transparent, url(), gradients, inherit...
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
function fontSizePx(decls: CssRule["decls"], tokenTable: Tokens): number | null {
  const value = decls["font-size"];
  if (value === undefined) return null;
  const step = /--fs-(\d+)/.exec(value);
  const raw = step !== null ? (tokenTable[`--fs-${step[1]}`] ?? "") : value;
  const rem = /([\d.]+)rem/.exec(raw);
  if (rem === null) return null;
  return Number(rem[1]) * 16;
}

const isBold = (weight: string | undefined): boolean =>
  weight !== undefined && /(^|[\s,])(bold|[789]00)(?=[\s,)]|$)/.test(weight);

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text (24px, or 18.66px bold). */
function requiredRatio(rule: CssRule, tokenTable: Tokens): number {
  const px = fontSizePx(rule.decls, tokenTable);
  if (px !== null && (px >= 24 || (px >= 18.66 && isBold(rule.decls["font-weight"])))) return 3;
  return 4.5;
}

/** A cross-rule pair to check: the foreground rule and the background rule by selector. */
export interface ContrastPair {
  /** The selector whose `color` declaration is the foreground. */
  color: string;
  /** The selector whose `background` (or `background-color`) declaration is the background. */
  background: string;
}

/** Options for `auditContrast`. */
export interface AuditContrastOptions {
  /** The game's ui/ directory to audit. */
  uiDir: string;
  /** Minimum number of same-rule pairs that must be checked, so the audit cannot pass vacuously. */
  minChecked: number;
  /** Cross-rule pairs to check in addition to the same-rule ones. */
  pairs?: ContrastPair[];
}

/** What `auditContrast` found. */
export interface ContrastReport {
  /** Same-rule colour/background pairs that were checked. */
  checked: number;
  /** Pairs that miss the required ratio, and explicit pairs that could not be resolved. */
  failures: string[];
  /** Colour or background declarations naming a custom property that is defined nowhere. */
  unresolved: string[];
}

/** The first rule matching `selector` with a resolvable value for `property`. */
function declOf(
  selector: string,
  property: "color" | "background",
  files: Array<{ file: string; css: string }>,
  tokenTable: Tokens,
): { resolution: ColorResolution; rule: CssRule | undefined } {
  for (const { css } of files) {
    for (const rule of rules(css)) {
      if (rule.selector !== selector) continue;
      const value =
        property === "color"
          ? rule.decls.color
          : (rule.decls.background ?? rule.decls["background-color"]);
      const resolution = resolveColor(value, tokenTable);
      if (resolution.hex !== null || resolution.missing !== undefined) {
        return { resolution, rule };
      }
    }
  }
  return { resolution: { hex: null }, rule: undefined };
}

/**
 * Checks WCAG AA text contrast over a game's ui/ directory. Same-rule colour/background pairs are
 * checked automatically; cross-rule pairs come from `pairs`. A pair that only reaches the large-text
 * ratio (3:1) must have a statically resolvable font size of at least 24px (18.66px bold). Fails by
 * throwing when fewer than `minChecked` same-rule pairs were checked.
 */
export function auditContrast(options: AuditContrastOptions): ContrastReport {
  const files = cssFiles(options.uiDir);
  const tokenTable = tokens(files);
  // A variable assigned in any rule (e.g. a per-card --tape) is not "defined nowhere", even though
  // its value cannot be resolved for contrast.
  const defined = new Set<string>();
  for (const { css } of files) {
    for (const rule of rules(css)) {
      for (const name of Object.keys(rule.decls)) if (name.startsWith("--")) defined.add(name);
    }
  }
  const failures: string[] = [];
  const unresolved: string[] = [];
  let checked = 0;
  for (const { file, css } of files) {
    for (const rule of rules(css)) {
      // Inactive UI components are exempt from WCAG 1.4.3.
      if (rule.selector.includes(":disabled")) continue;
      const fg = resolveColor(rule.decls.color, tokenTable);
      const bg = resolveColor(rule.decls.background ?? rule.decls["background-color"], tokenTable);
      for (const [property, resolution] of [
        ["color", fg],
        ["background", bg],
      ] as const) {
        if (resolution.missing !== undefined && !defined.has(resolution.missing)) {
          unresolved.push(
            `${file} ${rule.selector}: ${property} var(${resolution.missing}) is defined nowhere`,
          );
        }
      }
      if (fg.hex === null || bg.hex === null) continue;
      ++checked;
      const ratio = contrast(fg.hex, bg.hex);
      const need = requiredRatio(rule, tokenTable);
      if (ratio < need - 1e-9) {
        failures.push(
          `${file} ${rule.selector}: ${fg.hex} on ${bg.hex} is ${ratio.toFixed(2)}:1 (needs ${need}:1)`,
        );
      }
    }
  }
  for (const pair of options.pairs ?? []) {
    const fg = declOf(pair.color, "color", files, tokenTable);
    const bg = declOf(pair.background, "background", files, tokenTable);
    if (fg.rule === undefined || fg.resolution.hex === null) {
      failures.push(`pair ${pair.color}: no rule with a resolvable colour`);
      continue;
    }
    if (bg.rule === undefined || bg.resolution.hex === null) {
      failures.push(`pair ${pair.background}: no rule with a resolvable background`);
      continue;
    }
    const ratio = contrast(fg.resolution.hex, bg.resolution.hex);
    const need = requiredRatio(fg.rule, tokenTable);
    if (ratio < need - 1e-9) {
      failures.push(
        `pair ${fg.rule.selector} on ${bg.rule.selector}: ${fg.resolution.hex} on ${bg.resolution.hex} is ${ratio.toFixed(2)}:1 (needs ${need}:1)`,
      );
    }
  }
  if (checked < options.minChecked) {
    throw new Error(
      `auditContrast checked ${checked} pairs, fewer than the minimum of ${options.minChecked}`,
    );
  }
  return { checked, failures, unresolved };
}

/** True when an enclosing @media opts into motion (the user does not request reduced motion). */
const allowsMotion = (media: string[]): boolean =>
  media.some((condition) => /prefers-reduced-motion:\s*no-preference/.test(condition));

/** Options for `auditReducedMotion`. */
export interface ReducedMotionOptions {
  /** The game's ui/ directory to audit. */
  uiDir: string;
  /** Minimum number of guarded motion declarations, so the audit cannot pass vacuously. */
  minGuarded: number;
  /** Files (relative to `uiDir`) exempt from the Svelte motion-directive scan. */
  allow?: string[];
}

/** What `auditReducedMotion` found. */
export interface ReducedMotionReport {
  /** Motion declarations that sit inside a no-preference block. */
  guarded: number;
  /** Transitions, animations and smooth scrolling outside any no-preference block. */
  unguarded: string[];
  /** .svelte files using transition/in/out/animate directives that are not allowed. */
  directives: string[];
}

/** The Svelte motion directives, as they appear in markup: `in:`, `out:`, `transition:` and `animate:`. */
const MOTION_DIRECTIVE = /\b(transition|in|out|animate):[a-zA-Z]/;

/** The markup of every .svelte file under `uiDir`, with its <style> and <script> blocks removed. */
function svelteMarkup(uiDir: string): Array<{ file: string; markup: string }> {
  const out: Array<{ file: string; markup: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".svelte")) continue;
      const text = readFileSync(path, "utf8")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
      out.push({ file: path.slice(uiDir.length + 1), markup: text });
    }
  };
  walk(uiDir);
  return out;
}

/**
 * Checks that every transition, animation and `scroll-behavior: smooth` sits inside a
 * `prefers-reduced-motion: no-preference` block (a value of exactly `none` is exempt), and that no
 * .svelte file uses Svelte motion directives unless it is in the allow list. Fails by throwing when
 * fewer than `minGuarded` declarations are guarded.
 */
export function auditReducedMotion(options: ReducedMotionOptions): ReducedMotionReport {
  const unguarded: string[] = [];
  const directives: string[] = [];
  let guarded = 0;
  for (const { file, css } of cssFiles(options.uiDir)) {
    for (const rule of rules(css)) {
      // a value of "none" disables motion, so it is safe in any media block
      const names = Object.keys(rule.decls).filter((name) => {
        if (/^(transition|animation)/.test(name)) return rule.decls[name] !== "none";
        return name === "scroll-behavior" && rule.decls[name] === "smooth";
      });
      if (names.length === 0) continue;
      if (allowsMotion(rule.media)) {
        guarded += names.length;
        continue;
      }
      for (const name of names) unguarded.push(`${file} ${rule.selector}: ${name}`);
    }
  }
  const allowed = options.allow ?? [];
  for (const { file, markup } of svelteMarkup(options.uiDir)) {
    if (allowed.some((name) => file === name || file.endsWith(`/${name}`))) continue;
    if (MOTION_DIRECTIVE.test(markup)) directives.push(file);
  }
  if (guarded < options.minGuarded) {
    throw new Error(
      `auditReducedMotion guarded ${guarded} declarations, fewer than the minimum of ${options.minGuarded}`,
    );
  }
  return { guarded, unguarded, directives };
}
