import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const TEMPLATE = fileURLToPath(new URL("../template/package.json", import.meta.url));
const REFERENCE = fileURLToPath(new URL("../../../games/wit-clash/package.json", import.meta.url));

const readManifest = async (path: string): Promise<Manifest> =>
  JSON.parse(await readFile(path, "utf8")) as Manifest;

const merged = (manifest: Manifest): Record<string, string> => ({
  ...manifest.dependencies,
  ...manifest.devDependencies,
});

describe("template dependency versions", () => {
  it("matches the reference game's range for every shared non-workspace dependency", async () => {
    const templateDeps = merged(await readManifest(TEMPLATE));
    const referenceDeps = merged(await readManifest(REFERENCE));
    const drift = Object.entries(templateDeps)
      .filter(([name, range]) => {
        if (name.startsWith("@partygame/")) return false; // workspace:* in both
        const referenceRange = referenceDeps[name];
        return referenceRange !== undefined && referenceRange !== range;
      })
      .map(([name, range]) => `${name}: template ${range} vs wit-clash ${referenceDeps[name]}`);
    expect(drift).toEqual([]);
  });

  it("has no non-workspace dependency missing from the reference game", async () => {
    const templateDeps = merged(await readManifest(TEMPLATE));
    const referenceDeps = merged(await readManifest(REFERENCE));
    const missing = Object.keys(templateDeps).filter(
      (name) => !name.startsWith("@partygame/") && referenceDeps[name] === undefined,
    );
    expect(missing).toEqual([]);
  });
});
