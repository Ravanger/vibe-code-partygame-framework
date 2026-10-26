import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTRACT_VARIABLES } from "../src/themeContract.js";

// node:path, not new URL(rel, import.meta.url): the jsdom environment resolves relatives against
// its document base (http://localhost:3000), not the file URL.
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "theme-contract.css"), "utf8");
const readme = readFileSync(join(here, "..", "README.md"), "utf8");

describe("theme contract", () => {
  it("defines every contract variable in the stylesheet", () => {
    for (const name of CONTRACT_VARIABLES) {
      expect(css, `missing ${name}`).toMatch(new RegExp(`^\\s*${name}:\\s*\\S`, "m"));
    }
  });

  it("ships the sr-only utility", () => {
    expect(css).toContain(".sr-only {");
  });

  it("documents exactly the contract variables in the README", () => {
    const line = readme.split("\n").find((entry) => entry.includes("Custom properties:")) ?? "";
    expect(line).not.toHaveLength(0);
    const documented = [...line.matchAll(/`(--[\w-]+)`/g)].map((match) => match[1]).sort();
    expect(documented).toEqual([...CONTRACT_VARIABLES].sort());
  });
});
