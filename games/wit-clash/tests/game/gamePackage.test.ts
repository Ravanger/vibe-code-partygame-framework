import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { META } from "../../src/meta.js";
import { WitClashState } from "../../src/state.js";
import { makeCategories } from "./support.js";

describe("gamePackage", () => {
  it("describes WitClash for a server to host", () => {
    expect(gamePackage.meta).toBe(META);
    expect(gamePackage.stateClass).toBe(WitClashState);
    expect(gamePackage.definition(makeCategories()).name).toBe("WitClash");
  });

  it("loads the content from WITCLASH_CONTENT_DIR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "witclash-"));
    for (const id of ["a", "b", "c"])
      await writeFile(
        join(dir, `${id}.jsonc`),
        JSON.stringify({ id, name: id, prompts: [{ id: `${id}-1`, text: "Say something." }] }),
      );
    if (gamePackage.load === undefined) throw new Error("expected a load function");
    const categories = await gamePackage.load({ WITCLASH_CONTENT_DIR: dir });
    expect(categories.all().map((category) => category.id)).toEqual(["a", "b", "c"]);
  });
});
