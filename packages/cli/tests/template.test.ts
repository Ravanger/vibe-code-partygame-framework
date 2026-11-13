import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";
import { formatGame } from "../src/create.js";
import { deriveNames } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";

const TEMPLATE = fileURLToPath(new URL("./fixtures/template", import.meta.url));
const SHIPPED_TEMPLATE = fileURLToPath(new URL("../template", import.meta.url));
const NAMES = deriveNames("my-game");
const TOKEN = /__[A-Za-z]+__/;

const freshDir = (prefix: string): Promise<string> => mkdtemp(join(tmpdir(), prefix));

describe("renderTemplate", () => {
  it("renders every file into the output tree, substituting all tokens", async () => {
    const dest = await freshDir("cli-render-");
    await renderTemplate({ templateDir: TEMPLATE, outDir: dest, names: NAMES });
    expect(await readFile(join(dest, "root.txt"), "utf8")).toBe(
      "name=my-game\npackage=@partygame/my-game\npascal=MyGame\n",
    );
    expect(await readFile(join(dest, "nested/leaf.txt"), "utf8")).toBe(
      "camel=myGame\nroom=my_game\ndisplay=My Game\n",
    );
    expect(await readFile(join(dest, "run.sh"), "utf8")).toBe("#!/bin/sh\necho my-game\n");
  });

  it("leaves no __token__ behind in any rendered file", async () => {
    const dest = await freshDir("cli-render-");
    await renderTemplate({ templateDir: TEMPLATE, outDir: dest, names: NAMES });
    for (const file of ["root.txt", "nested/leaf.txt", "run.sh"]) {
      expect(await readFile(join(dest, file), "utf8")).not.toMatch(TOKEN);
    }
  });

  it("preserves line endings and executable modes", async () => {
    const src = await freshDir("cli-tmpl-");
    await writeFile(join(src, "crlf.txt"), "a=__slug__\r\nb=__PascalName__\r\n");
    const script = join(src, "run.sh");
    await writeFile(script, "#!/bin/sh\necho __roomName__\n", { mode: 0o755 });
    const dest = await freshDir("cli-out-");
    await renderTemplate({ templateDir: src, outDir: dest, names: NAMES });
    expect(await readFile(join(dest, "crlf.txt"), "utf8")).toBe("a=my-game\r\nb=MyGame\r\n");
    const mode = async (path: string) => (await stat(path)).mode & 0o777;
    expect(await mode(join(dest, "run.sh"))).toBe(await mode(script));
  });

  it("substitutes tokens in file names as well", async () => {
    const src = await freshDir("cli-tmpl-");
    await writeFile(join(src, "__camelName__Bot.txt"), "bot for __slug__\n");
    const dest = await freshDir("cli-out-");
    await renderTemplate({ templateDir: src, outDir: dest, names: NAMES });
    expect(await readFile(join(dest, "myGameBot.txt"), "utf8")).toBe("bot for my-game\n");
  });

  it("skips excluded paths and renames the rest", async () => {
    const src = await freshDir("cli-tmpl-");
    await writeFile(join(src, "keep.txt"), "__slug__\n");
    await writeFile(join(src, "drop.txt"), "gone\n");
    await mkdir(join(src, "ui"));
    await writeFile(join(src, "ui/app.svelte"), "<p>__slug__</p>\n");
    const dest = await freshDir("cli-out-");
    await renderTemplate({
      templateDir: src,
      outDir: dest,
      names: NAMES,
      exclude: ["drop.txt", "ui/"],
      rename: { "keep.txt": "renamed.txt" },
    });
    expect(await readFile(join(dest, "renamed.txt"), "utf8")).toBe("my-game\n");
    for (const gone of ["keep.txt", "drop.txt", "ui"]) {
      expect(existsSync(join(dest, gone)), gone).toBe(false);
    }
  });

  it("treats substituted values as data: a display name containing token text stays literal", async () => {
    const dest = await freshDir("cli-out-");
    const names = { ...NAMES, displayName: "A __roomName__ and a __slug__" };
    await renderTemplate({ templateDir: TEMPLATE, outDir: dest, names });
    expect(await readFile(join(dest, "nested/leaf.txt"), "utf8")).toBe(
      "camel=myGame\nroom=my_game\ndisplay=A __roomName__ and a __slug__\n",
    );
  });

  it("renders the shipped template with no token left in any file name or content", async () => {
    const dest = await freshDir("cli-shipped-");
    await renderTemplate({
      templateDir: SHIPPED_TEMPLATE,
      outDir: dest,
      names: deriveNames("wave-game"),
    });
    const leftovers = async (dir: string): Promise<string[]> => {
      const found: string[] = [];
      for (const entry of await readdir(dir)) {
        const full = join(dir, entry);
        if ((await stat(full)).isDirectory()) {
          found.push(...(await leftovers(full)));
        } else if (TOKEN.test(entry) || TOKEN.test(await readFile(full, "utf8"))) {
          found.push(full);
        }
      }
      return found;
    };
    expect(await leftovers(dest)).toEqual([]);
  });

  it("renders a hostile display name as a valid escaped literal in code contexts", async () => {
    const dest = await freshDir("cli-hostile-");
    // A quote, a backslash and an embedded newline: each of these breaks a raw TS string literal.
    const names = { ...NAMES, displayName: 'Bob "The Builder" \\ \n test' };
    await renderTemplate({ templateDir: SHIPPED_TEMPLATE, outDir: dest, names });
    for (const file of ["src/game.ts", "gamePackage.ts", "tests/game/gamePackage.test.ts"]) {
      const code = await readFile(join(dest, file), "utf8");
      expect(
        transpileModule(code, {
          reportDiagnostics: true,
          compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
        }).diagnostics ?? [],
        file,
      ).toEqual([]);
    }
  });

  it("renders a hostile display name as valid JSON in package.json", async () => {
    const dest = await freshDir("cli-json-");
    // A quote, a backslash and an embedded newline: each of these breaks a raw JSON string.
    const names = { ...NAMES, displayName: 'Bob "The Builder" \\ \n test' };
    await renderTemplate({ templateDir: SHIPPED_TEMPLATE, outDir: dest, names });
    const parsed = JSON.parse(await readFile(join(dest, "package.json"), "utf8")) as {
      partygame?: { name?: unknown };
    };
    expect(parsed.partygame?.name).toBe(names.displayName);
  });

  it("renders a hostile display name escaped in HTML and Markdown contexts", async () => {
    // Inside the repo so biome can check the output (vcs.ignoreFile refuses paths outside it).
    const dest = await mkdtemp(join(fileURLToPath(new URL("../..", import.meta.url)), "qa-html-"));
    try {
      const names = { ...NAMES, displayName: "<b>&\"'" };
      await renderTemplate({ templateDir: SHIPPED_TEMPLATE, outDir: dest, names });
      expect(await readFile(join(dest, "index.html"), "utf8")).toContain(
        "<title>&lt;b&gt;&amp;&quot;&#39;</title>",
      );
      expect(await readFile(join(dest, "README.md"), "utf8")).toMatch(
        /^# &lt;b&gt;&amp;&quot;&#39;$/m,
      );
      expect(await readFile(join(dest, "AGENTS.md"), "utf8")).toContain(
        "The &lt;b&gt;&amp;&quot;&#39; game:",
      );
      for (const file of ["ui/App.svelte", "ui/screens/Welcome.svelte"]) {
        expect(await readFile(join(dest, file), "utf8")).toContain("&lt;b&gt;&amp;&quot;&#39;");
      }
      expect(formatGame(dest)).toBe(0);
    } finally {
      await rm(dest, { recursive: true, force: true });
    }
  });

  it("escapes backslashes and newlines for the Markdown placeholder", async () => {
    const dest = await freshDir("cli-md-");
    const names = { ...NAMES, displayName: "C:\\new\r\nline" };
    await renderTemplate({ templateDir: SHIPPED_TEMPLATE, outDir: dest, names });
    expect(await readFile(join(dest, "README.md"), "utf8")).toMatch(/^# C:\\\\new line$/m);
  });

  it("rejects when the template directory is missing", async () => {
    const dest = await freshDir("cli-out-");
    await expect(
      renderTemplate({ templateDir: join(dest, "does-not-exist"), outDir: dest, names: NAMES }),
    ).rejects.toThrow(/template directory/);
  });

  it("rejects when the template path is a file, not a directory", async () => {
    const dest = await freshDir("cli-out-");
    await expect(
      renderTemplate({ templateDir: join(TEMPLATE, "run.sh"), outDir: dest, names: NAMES }),
    ).rejects.toThrow(/template directory/);
  });
});

describe("shipped template theme", () => {
  // check:boundaries keeps the cli free of @partygame/* imports, so the required-class list is
  // read from game-ui's source instead of imported; packages/game-ui/tests/themeContract.test.ts
  // keeps that list in sync with the components' markup.
  const THEME_CONTRACT_TS = fileURLToPath(
    new URL("../../game-ui/src/themeContract.ts", import.meta.url),
  );

  it("defines every global class the framework components need, plus --font-hand for .hand", () => {
    const block = /export const REQUIRED_GLOBAL_CLASSES = \[([\s\S]*?)\] as const/.exec(
      readFileSync(THEME_CONTRACT_TS, "utf8"),
    );
    expect(
      block,
      "REQUIRED_GLOBAL_CLASSES is missing from game-ui's themeContract.ts",
    ).not.toBeNull();
    const required = (block?.[1] ?? "").match(/"([a-z][a-z0-9-]*)"/g) ?? [];
    expect(required).not.toEqual([]);
    const css = readFileSync(join(SHIPPED_TEMPLATE, "ui", "app.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    for (const cls of required.map((quoted) => quoted.slice(1, -1))) {
      expect(css, `the template app.css has no rule for .${cls}`).toMatch(
        new RegExp(`\\.${cls}(?![\\w-])`),
      );
    }
    // the .hand rule reads var(--font-hand); without it the handwriting font silently falls back
    expect(css).toMatch(/--font-hand\s*:/);
  });
});
