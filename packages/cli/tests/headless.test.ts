import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pruneHeadlessGame } from "../src/create.js";
import { deriveNames } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";

const SHIPPED_TEMPLATE = fileURLToPath(new URL("../template", import.meta.url));
const fresh = (prefix: string) => mkdtemp(join(tmpdir(), prefix));

interface Rendered {
  dir: string;
  done: () => Promise<void>;
}

/** Renders the shipped template into a temp dir; `done` removes it. */
async function rendered(): Promise<Rendered> {
  const dir = await fresh("cli-headless-");
  try {
    await renderTemplate({
      templateDir: SHIPPED_TEMPLATE,
      outDir: dir,
      names: deriveNames("my-game"),
    });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, done: () => rm(dir, { recursive: true, force: true }) };
}

const readJson = async <T>(dir: string, file: string): Promise<T> =>
  JSON.parse(await readFile(join(dir, file), "utf8")) as T;

interface Manifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

describe("pruneHeadlessGame", () => {
  it("trims the manifest to headless dependencies and scripts", async () => {
    const { dir, done } = await rendered();
    try {
      pruneHeadlessGame(dir);
      const pkg = await readJson<Manifest>(dir, "package.json");
      expect(pkg.dependencies["@partygame/game-ui"]).toBeUndefined();
      expect(pkg.dependencies["@partygame/game-client"]).toBeUndefined();
      for (const kept of [
        "@colyseus/schema",
        "@partygame/bots",
        "@partygame/core",
        "@partygame/game-kit",
        "@partygame/shared",
        "@partygame/terminal",
        "zod",
      ]) {
        expect(pkg.dependencies[kept], kept).toBeDefined();
      }
      expect(pkg.devDependencies["@partygame/game-client"]).toBe("workspace:*");
      for (const dropped of [
        "@sveltejs/vite-plugin-svelte",
        "@testing-library/jest-dom",
        "@testing-library/svelte",
        "jsdom",
        "svelte",
        "svelte-check",
        "vite",
      ]) {
        expect(pkg.devDependencies[dropped], dropped).toBeUndefined();
      }
      for (const kept of ["@partygame/config", "vitest"]) {
        expect(pkg.devDependencies[kept], kept).toBeDefined();
      }
      for (const dropped of ["dev", "build", "test:all"]) {
        expect(pkg.scripts[dropped], dropped).toBeUndefined();
      }
      expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
      expect(pkg.scripts.test).toBe("vitest run");
      expect(pkg.scripts["dev:server"]).toBeDefined();
      expect(pkg.scripts.demo).toBeDefined();
      // The moved dependency keeps the manifest's alphabetical order.
      const raw = await readFile(join(dir, "package.json"), "utf8");
      expect(raw.indexOf("@partygame/config")).toBeLessThan(raw.indexOf("@partygame/game-client"));
      expect(raw.indexOf("@partygame/game-client")).toBeLessThan(raw.indexOf("vitest"));
    } finally {
      await done();
    }
  });

  it("clears the tsconfig types so tsc needs no UI type packages", async () => {
    const { dir, done } = await rendered();
    try {
      pruneHeadlessGame(dir);
      const tsconfig = await readJson<{ compilerOptions?: { types?: string[] } }>(
        dir,
        "tsconfig.json",
      );
      expect(tsconfig.compilerOptions?.types).toEqual([]);
    } finally {
      await done();
    }
  });

  it("drops the UI-only PhaseName type from phaseNames", async () => {
    const { dir, done } = await rendered();
    try {
      pruneHeadlessGame(dir);
      const phaseNames = await readFile(join(dir, "src", "phaseNames.ts"), "utf8");
      expect(phaseNames).not.toContain("PhaseName");
      expect(phaseNames).toContain('Waving: "Waving"');
      expect(phaseNames.endsWith("} as const;\n")).toBe(true);
    } finally {
      await done();
    }
  });

  it("rewords the agent docs to the headless shape", async () => {
    const { dir, done } = await rendered();
    try {
      pruneHeadlessGame(dir);
      const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
      expect(agents).toContain("rules and entry points");
      expect(agents).not.toContain("UI screens");
      const mayImport = agents.slice(agents.indexOf("## May import"));
      expect(mayImport).not.toContain("@partygame/game-ui");
      const runtimeLine = mayImport.split("\n").find((line) => line.startsWith("- Runtime:"));
      expect(runtimeLine).toBeDefined();
      expect(runtimeLine).not.toContain("@partygame/game-client");
      expect(mayImport).toContain("- Dev: `@partygame/config`, `@partygame/game-client`");
      const entries = agents.split("\n").find((line) => line.includes("Entries:"));
      expect(entries).toBeDefined();
      expect(entries).not.toContain("ui/main.ts");
      expect(agents).not.toContain("UI tests");
    } finally {
      await done();
    }
  });

  it("throws when a template line it expects is missing", async () => {
    const { dir, done } = await rendered();
    try {
      const agentsPath = join(dir, "AGENTS.md");
      const agents = await readFile(agentsPath, "utf8");
      await writeFile(
        agentsPath,
        agents.replace("rules, UI screens and entry points", "other words"),
      );
      expect(() => pruneHeadlessGame(dir)).toThrowError(/AGENTS\.md/);
    } finally {
      await done();
    }
  });

  it("throws when the manifest no longer lists @partygame/game-client in dependencies", async () => {
    const { dir, done } = await rendered();
    try {
      const pkgPath = join(dir, "package.json");
      const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
        dependencies: Record<string, string>;
      };
      delete pkg.dependencies["@partygame/game-client"];
      await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      expect(() => pruneHeadlessGame(dir)).toThrowError(/package\.json/);
    } finally {
      await done();
    }
  });
});
