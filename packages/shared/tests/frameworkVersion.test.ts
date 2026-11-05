import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FRAMEWORK_VERSION } from "../src/protocol.js";

const PACKAGES_DIR = resolve(import.meta.dirname, "../..");

function versionOf(packageDir: string): string {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGES_DIR, packageDir, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}

describe("FRAMEWORK_VERSION", () => {
  it("equals the shared package version", () => {
    expect(FRAMEWORK_VERSION).toBe(versionOf("shared"));
  });

  it("equals the version of every package, which are versioned together", () => {
    const versions = Object.fromEntries(
      readdirSync(PACKAGES_DIR).map((dir) => [dir, versionOf(dir)]),
    );
    expect(Object.keys(versions)).toContain("shared");
    const mismatched = Object.entries(versions).filter(
      ([, version]) => version !== FRAMEWORK_VERSION,
    );
    expect(mismatched).toEqual([]);
  });
});
