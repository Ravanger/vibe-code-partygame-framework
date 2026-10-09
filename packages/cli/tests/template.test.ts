import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";
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
    for (const file of ["src/game.ts", "launch.ts", "tests/game/hostedGame.test.ts"]) {
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
