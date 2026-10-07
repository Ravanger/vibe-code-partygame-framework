import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveNames } from "../src/slug.js";
import { renderTemplate } from "../src/template.js";

const TEMPLATE = fileURLToPath(new URL("./fixtures/template", import.meta.url));
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
    const mode = (await stat(join(dest, "run.sh"))).mode & 0o777;
    expect(mode & 0o111).not.toBe(0);
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
