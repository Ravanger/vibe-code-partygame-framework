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

/** The backticked variables on the README's custom-properties line, expanding "`--x-1` to `--x-4`" ranges. */
function readmeVariables(line: string): string[] {
  const vars: string[] = [];
  const rest = line.replace(
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

describe("theme-contract.css", () => {
  it("defines every contract variable on :root", () => {
    for (const name of CONTRACT_VARIABLES) {
      expect(contractCss, `${name} is not defined`).toMatch(new RegExp(`${name}\\s*:`));
    }
  });

  it("provides the .sr-only utility", () => {
    expect(contractCss).toMatch(/\.sr-only\s*\{/);
  });
});

describe("README contract list", () => {
  const line = readme
    .split("\n")
    .filter((l) => l.startsWith("- Custom properties:"))
    .join("\n");

  it("lists exactly the CONTRACT_VARIABLES", () => {
    expect(readmeVariables(line)).toEqual([...CONTRACT_VARIABLES].sort());
  });
});
