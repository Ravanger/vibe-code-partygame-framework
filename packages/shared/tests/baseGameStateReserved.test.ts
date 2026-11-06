import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BaseGameState } from "../src/schema/BaseGameState.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const MARKER = "Reserved field names:";

function documentedFields(file: string): string[] {
  const line = readFileSync(join(REPO_ROOT, file), "utf8")
    .split("\n")
    .find((candidate) => candidate.includes(MARKER));
  if (line === undefined) {
    throw new Error(`${file} does not list the reserved field names`);
  }
  const sentence = line.slice(line.indexOf(MARKER)).split(".")[0] ?? "";
  return [...sentence.matchAll(/`(\w+)`/g)].map((match) => match[1] ?? "").sort();
}

describe("BaseGameState reserved field names", () => {
  const actual = Object.keys(new BaseGameState().toJSON()).sort();

  it("are listed in the BaseGameState JSDoc", () => {
    expect(documentedFields("packages/shared/src/schema/BaseGameState.ts")).toEqual(actual);
  });

  it("are listed in the framework README", () => {
    expect(documentedFields("docs/framework/README.md")).toEqual(actual);
  });
});
