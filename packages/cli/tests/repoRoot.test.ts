import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findRepoRoot } from "../src/repoRoot.js";

const fresh = (prefix: string) => mkdtemp(join(tmpdir(), prefix));
const writePkg = (dir: string, pkg: object): Promise<void> =>
  writeFile(join(dir, "package.json"), JSON.stringify(pkg));

describe("findRepoRoot", () => {
  it("returns the nearest package.json whose workspaces include games/*", async () => {
    const root = await fresh("cli-root-");
    await writePkg(root, { name: "root", workspaces: ["packages/*", "games/*"] });
    const nested = join(root, "a", "b");
    await mkdir(nested, { recursive: true });
    expect(await findRepoRoot(nested)).toBe(root);
  });

  it("keeps walking past a package.json that does not include games/*", async () => {
    const root = await fresh("cli-root-");
    await writePkg(root, { name: "root", workspaces: ["packages/*", "games/*"] });
    const mid = join(root, "mid");
    await mkdir(mid);
    await writePkg(mid, { name: "mid", workspaces: ["lib/*"] });
    expect(await findRepoRoot(mid)).toBe(root);
  });

  it("keeps walking past a package.json with no workspaces", async () => {
    const root = await fresh("cli-root-");
    await writePkg(root, { name: "root", workspaces: ["games/*"] });
    const mid = join(root, "mid");
    await mkdir(mid);
    await writePkg(mid, { name: "mid" });
    expect(await findRepoRoot(mid)).toBe(root);
  });

  it("throws when no ancestor is a monorepo root", async () => {
    const leaf = await fresh("cli-leaf-");
    await writePkg(leaf, { name: "lonely", workspaces: ["x/*"] });
    await expect(findRepoRoot(leaf)).rejects.toThrow(/no monorepo root/);
  });
});
