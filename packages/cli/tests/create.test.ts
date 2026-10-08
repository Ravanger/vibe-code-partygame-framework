import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessage, formatGame, parseCreateArgs, runCreate } from "../src/create.js";

const TEMPLATE = fileURLToPath(new URL("./fixtures/template", import.meta.url));
const fresh = (prefix: string) => mkdtemp(join(tmpdir(), prefix));
const makeRoot = async (): Promise<string> => {
  const root = await fresh("cli-root-");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["packages/*", "games/*"] }),
  );
  return root;
};

afterEach(() => vi.restoreAllMocks());

describe("parseCreateArgs", () => {
  it("parses a bare slug", () => {
    expect(parseCreateArgs(["my-game"])).toEqual({ ok: true, slug: "my-game" });
  });

  it("parses a slug with --name", () => {
    expect(parseCreateArgs(["my-game", "--name", "My Game"])).toEqual({
      ok: true,
      slug: "my-game",
      name: "My Game",
    });
  });

  it("is a usage error with no arguments", () => {
    const result = parseCreateArgs([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Usage/);
  });

  it("is a usage error when --name has no value", () => {
    expect(parseCreateArgs(["my-game", "--name"]).ok).toBe(false);
  });

  it("rejects an unexpected argument", () => {
    const result = parseCreateArgs(["my-game", "extra"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("extra");
  });

  it("reports an invalid slug", () => {
    const result = parseCreateArgs(["Bad-Slug"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid slug/);
  });
});

describe("errorMessage", () => {
  it("uses the message of an Error", () => expect(errorMessage(new Error("boom"))).toBe("boom"));
  it("stringifies anything else", () => expect(errorMessage("raw")).toBe("raw"));
});

describe("runCreate", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("returns 1 for an invalid slug without touching the filesystem", async () => {
    const spy = quiet();
    const cwd = await fresh("cli-cwd-");
    const code = await runCreate({
      slug: "Bad-Slug",
      cwd,
      templateDir: TEMPLATE,
      format: () => 0,
      install: () => 0,
    });
    expect(code).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/invalid slug/));
  });

  it("returns 1 when no repo root is found", async () => {
    const spy = quiet();
    const cwd = await fresh("cli-nowhere-");
    const code = await runCreate({
      slug: "my-game",
      cwd,
      templateDir: TEMPLATE,
      format: () => 0,
      install: () => 0,
    });
    expect(code).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/no monorepo root/));
  });

  it("returns 1 when the game directory already exists", async () => {
    const spy = quiet();
    const root = await makeRoot();
    await mkdir(join(root, "games", "my-game"), { recursive: true });
    const code = await runCreate({
      slug: "my-game",
      cwd: root,
      templateDir: TEMPLATE,
      format: () => 0,
      install: () => 0,
    });
    expect(code).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/already exists/));
  });

  it("returns 1 when the template cannot be rendered", async () => {
    const spy = quiet();
    const root = await makeRoot();
    const code = await runCreate({
      slug: "my-game",
      cwd: root,
      templateDir: join(root, "no-template"),
      format: () => 0,
      install: () => 0,
    });
    expect(code).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/failed to create/));
  });

  it("propagates a non-zero install code and reports it", async () => {
    const spy = quiet();
    const root = await makeRoot();
    const install = vi.fn().mockReturnValue(3);
    const code = await runCreate({
      slug: "my-game",
      name: "My Game",
      cwd: root,
      templateDir: TEMPLATE,
      format: () => 0,
      install,
    });
    expect(code).toBe(3);
    expect(install).toHaveBeenCalledWith(root);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/install failed with exit code 3/));
  });

  it("formats the rendered game before installing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const root = await makeRoot();
    const calls: string[] = [];
    const format = vi.fn().mockImplementation((): number => {
      calls.push("format");
      return 0;
    });
    const install = vi.fn().mockImplementation((): number => {
      calls.push("install");
      return 0;
    });
    const code = await runCreate({
      slug: "my-game",
      cwd: root,
      templateDir: TEMPLATE,
      format,
      install,
    });
    expect(code).toBe(0);
    expect(format).toHaveBeenCalledWith(join(root, "games", "my-game"));
    expect(calls).toEqual(["format", "install"]);
  });

  it("returns the format code when formatting fails, without installing", async () => {
    const spy = quiet();
    const root = await makeRoot();
    const install = vi.fn().mockReturnValue(0);
    const code = await runCreate({
      slug: "my-game",
      cwd: root,
      templateDir: TEMPLATE,
      format: () => 7,
      install,
    });
    expect(code).toBe(7);
    expect(install).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/biome check --write failed with exit code 7/),
    );
  });

  it("renders the game and returns 0 on success", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const root = await makeRoot();
    const install = vi.fn().mockReturnValue(0);
    const code = await runCreate({
      slug: "my-game",
      cwd: root,
      templateDir: TEMPLATE,
      format: () => 0,
      install,
    });
    expect(code).toBe(0);
    expect(install).toHaveBeenCalledWith(root);
    expect(await readFile(join(root, "games", "my-game", "root.txt"), "utf8")).toBe(
      "name=my-game\npackage=@partygame/my-game\npascal=MyGame\n",
    );
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Created games\/my-game\//));
  });
});

describe("formatGame", () => {
  it("runs biome check --write on a directory and returns its exit code", async () => {
    // Biome refuses paths outside the repo root (vcs.ignoreFile), so probe inside packages/cli.
    const dir = await mkdtemp(join(fileURLToPath(new URL("../..", import.meta.url)), "qa-fmt-"));
    try {
      const file = join(dir, "a.ts");
      await writeFile(file, "const    x=1;\nexport{x};\n");
      expect(formatGame(dir)).toBe(0);
      expect(await readFile(file, "utf8")).toBe("const x = 1;\n\nexport { x };\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns 1 when the binary cannot be spawned", () => {
    expect(formatGame("games", "no-such-binary-xyz")).toBe(1);
  });
});
