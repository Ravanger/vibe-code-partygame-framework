import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_VARIABLES, REQUIRED_GLOBAL_CLASSES } from "../src/themeContract.js";

/** The suite runs with cwd either at the repo root (workspace) or in packages/game-ui. */
const here = process.cwd();
const pkgDir = existsSync(join(here, "theme-contract.css"))
  ? here
  : join(here, "packages", "game-ui");
const contractCss = readFileSync(join(pkgDir, "theme-contract.css"), "utf8");
const readme = readFileSync(join(pkgDir, "README.md"), "utf8");
const frameworkReadme = readFileSync(
  join(pkgDir, "..", "..", "docs", "framework", "README.md"),
  "utf8",
);

/** The body of the contract's :root block; empty when the file has none. */
const rootBlock = /:root\s*\{([\s\S]*?)\}/.exec(contractCss)?.[1] ?? "";

/** The declaration block of the contract's `main.tv` rule; empty when the file has none. */
const mainTvBlock = /main\.tv\s*{([^}]*)}/.exec(contractCss)?.[1] ?? "";

/** The backticked variables on a README's custom-properties line, expanding "`--x-1` to `--x-4`"
 * ranges; parenthetical notes (e.g. the framework README's `--tape` aside) are dropped first. */
function readmeVariables(line: string): string[] {
  const vars: string[] = [];
  const rest = line
    .replace(/\([^)]*\)/g, "")
    .replace(
      /`(--[a-z]+)-(\d)`\s*to\s*`\1-(\d)`/g,
      (_match, prefix: string, from: string, to: string) => {
        for (let i = Number(from); i <= Number(to); ++i) vars.push(`${prefix}-${i}`);
        return "";
      },
    );
  rest.replace(/`(--[a-z0-9-]+)`/g, (_match, name: string) => {
    vars.push(name);
    return "";
  });
  return vars.sort();
}

const customPropertiesLine = (text: string): string =>
  text
    .split("\n")
    .filter((l) => l.startsWith("- Custom properties:"))
    .join("\n");

describe("theme-contract.css", () => {
  it("defines every contract variable on :root with a non-empty value", () => {
    for (const name of CONTRACT_VARIABLES) {
      const decl = new RegExp(`${name}\\s*:\\s*(.+);`).exec(rootBlock);
      expect(decl, `${name} is not declared in the :root block with a value`).not.toBeNull();
    }
  });

  it("provides the .sr-only utility", () => {
    expect(contractCss).toMatch(/\.sr-only\s*\{/);
  });
});

describe("TV typography contract (main.tv)", () => {
  it("keeps the --fs-1 override at the 24px minimum under main.tv", () => {
    // fs-1 text on a TV screen renders as calc(var(--fs-1) * var(--scale, 1)) with --scale: 1.6,
    // so the single-point override must lift 0.875rem x 1.6 = 22.4px to at least 24px (0.9375rem x 1.6)
    expect(mainTvBlock).toMatch(/--fs-1:\s*0\.9375rem/);
  });

  it("keeps the TV scale factor at 1.6", () => {
    expect(mainTvBlock).toMatch(/--scale:\s*1\.6/);
  });
});

describe("README contract lists", () => {
  it("lists exactly the CONTRACT_VARIABLES in the package README", () => {
    expect(readmeVariables(customPropertiesLine(readme))).toEqual([...CONTRACT_VARIABLES].sort());
  });

  it("lists exactly the CONTRACT_VARIABLES in the framework README", () => {
    expect(readmeVariables(customPropertiesLine(frameworkReadme))).toEqual(
      [...CONTRACT_VARIABLES].sort(),
    );
  });
});

/** The class tokens a component renders in its markup — static `class` attributes, template-literal
 *  classes without interpolation and `class:` directives — minus the ones it styles in its own
 *  `<style>` block (scoped rules only reach the component's own elements). */
function globalClassTokens(source: string): Set<string> {
  const style = (/<style[^>]*>([\s\S]*?)<\/style>/i.exec(source)?.[1] ?? "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const markup = source.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  const tokens = new Set<string>();
  for (const match of markup.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|`([^`]*)`)/g)) {
    for (const token of (match[1] ?? match[2] ?? "").split(/\s+/)) {
      if (token !== "" && !token.includes("${")) tokens.add(token);
    }
  }
  for (const match of markup.matchAll(/\bclass:([a-zA-Z][\w-]*)\s*=/g)) {
    tokens.add(match[1] as string);
  }
  for (const match of style.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    tokens.delete(match[1] as string);
  }
  return tokens;
}

describe("REQUIRED_GLOBAL_CLASSES", () => {
  const componentsDir = join(pkgDir, "src", "components");
  const contractNoComments = contractCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const contractClasses = new Set(
    [...contractNoComments.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1] as string),
  );

  it("lists exactly the unscoped classes the components render that the contract does not ship", () => {
    const derived = new Set<string>();
    for (const file of readdirSync(componentsDir)
      .filter((f) => f.endsWith(".svelte"))
      .sort()) {
      for (const token of globalClassTokens(readFileSync(join(componentsDir, file), "utf8"))) {
        if (!contractClasses.has(token)) derived.add(token);
      }
    }
    expect([...derived].sort()).toEqual([...REQUIRED_GLOBAL_CLASSES].sort());
  });
});
