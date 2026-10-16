import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findCollision } from "../src/collisions.js";

const fresh = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

const makeRoot = async (): Promise<string> => {
  const root = await fresh("cli-collision-");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["packages/*", "games/*"] }),
  );
  return root;
};

const addFolder = async (root: string, area: "packages" | "games", folder: string) => {
  await mkdir(join(root, area, folder), { recursive: true });
};

const addPackage = async (
  root: string,
  area: "packages" | "games",
  folder: string,
  manifest?: unknown,
) => {
  await addFolder(root, area, folder);
  if (manifest !== undefined) {
    await writeFile(join(root, area, folder, "package.json"), JSON.stringify(manifest));
  }
};

describe("findCollision", () => {
  it("reports a slug whose package name already exists", async () => {
    const root = await makeRoot();
    await addPackage(root, "packages", "core", { name: "@partygame/core" });
    await expect(findCollision(root, "core")).resolves.toMatch(/@partygame\/core/);
  });

  it("reports a slug that is an existing game folder name", async () => {
    const root = await makeRoot();
    // A package name that does not match @partygame/<folder>, so the folder rule is what fires.
    await addPackage(root, "games", "odd-game", { name: "unscoped" });
    await expect(findCollision(root, "odd-game")).resolves.toMatch(/existing game/);
  });

  it("reports a slug that is an existing game's -game project name", async () => {
    const root = await makeRoot();
    await addPackage(root, "games", "alpha", { name: "@partygame/alpha" });
    const message = await findCollision(root, "alpha-game");
    expect(message).toBeDefined();
    expect(message).toMatch(/vitest project/);
  });

  it("reports a slug whose -game project is an existing game folder name", async () => {
    const root = await makeRoot();
    await addPackage(root, "games", "bar-game", { name: "@partygame/bar-game" });
    await expect(findCollision(root, "bar")).resolves.toMatch(/bar-game/);
  });

  it("reports the fixed project names cli and scripts without any folders on disk", async () => {
    const root = await makeRoot();
    for (const slug of ["cli", "scripts"]) {
      await expect(findCollision(root, slug)).resolves.toMatch(/fixed vitest project/);
    }
  });

  it("does not treat package folder names as game projects", async () => {
    const root = await makeRoot();
    await addPackage(root, "packages", "odd", { name: "unscoped-odd" });
    await expect(findCollision(root, "odd")).resolves.toBeUndefined();
  });

  it("skips folders without a valid package.json", async () => {
    const root = await makeRoot();
    await addFolder(root, "games", "notes"); // no manifest at all
    await addFolder(root, "packages", "invalid");
    await writeFile(join(root, "packages", "invalid", "package.json"), "{ not json");
    await addPackage(root, "packages", "numbered", { name: 7 });
    await addFolder(root, "packages", "nullish");
    await writeFile(join(root, "packages", "nullish", "package.json"), "null");
    await addFolder(root, "packages", "scalar");
    await writeFile(join(root, "packages", "scalar", "package.json"), '"just text"');
    await expect(findCollision(root, "notes")).resolves.toBeUndefined();
    await expect(findCollision(root, "invalid")).resolves.toBeUndefined();
    await expect(findCollision(root, "numbered")).resolves.toBeUndefined();
    await expect(findCollision(root, "nullish")).resolves.toBeUndefined();
    await expect(findCollision(root, "scalar")).resolves.toBeUndefined();
  });

  it("counts a game folder even when its manifest has no string name", async () => {
    const root = await makeRoot();
    await addPackage(root, "games", "unnamed", {});
    await expect(findCollision(root, "unnamed")).resolves.toMatch(/existing game/);
  });

  it("tolerates a root without packages/ or games/ directories", async () => {
    const root = await makeRoot();
    await expect(findCollision(root, "fresh-game")).resolves.toBeUndefined();
  });

  it("returns undefined for a free slug among existing workspaces", async () => {
    const root = await makeRoot();
    await addPackage(root, "packages", "core", { name: "@partygame/core" });
    await addPackage(root, "games", "beta", { name: "@partygame/beta" });
    await expect(findCollision(root, "fresh-game")).resolves.toBeUndefined();
  });
});
