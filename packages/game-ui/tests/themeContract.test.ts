import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_VARIABLES } from "../src/themeContract.js";

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
