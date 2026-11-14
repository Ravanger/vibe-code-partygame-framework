import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/** Every module specifier one source file imports (including side-effect and re-export forms). */
function specifiersOf(file: string): string[] {
  const source = readFileSync(join(here, file), "utf8");
  return [
    ...source.matchAll(/\b(?:import|export)\b[^"']*?\bfrom\s+["']([^"']+)["']/g),
    ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
  ]
    .map((match) => match[1])
    .filter((specifier): specifier is string => specifier !== undefined);
}

describe("createApiHandler import graph", () => {
  it("does not import createGameServer, so the API handler stays loadable without Colyseus", () => {
    const specifiers = specifiersOf("../src/api/createApiHandler.ts");
    expect(specifiers.filter((specifier) => specifier.startsWith("."))).not.toContain(
      "../createGameServer.js",
    );
  });
});
