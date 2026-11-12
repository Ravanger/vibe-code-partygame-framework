import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  contentDirFrom,
  loadJsoncDir,
  loadJsoncDirWithFiles,
  loadJsoncFile,
  stripJsonComments,
} from "../src/index.js";

describe("stripJsonComments", () => {
  it("removes line comments", () => {
    expect(stripJsonComments('{"a": 1} // comment')).toBe('{"a": 1} ');
  });

  it("removes block comments", () => {
    expect(stripJsonComments('{"a": 1} /* block */')).toBe('{"a": 1} ');
  });

  it("preserves // inside string literals", () => {
    const input = '{"url": "https://example.com"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("preserves /* */ inside string literals", () => {
    const input = '{"text": "not a /* comment */"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("handles escaped quotes inside strings", () => {
    const input = '{"text": "she said \\"hello\\" // not a comment"}';
    expect(stripJsonComments(input)).toBe(input);
  });

  it("handles multiple comments", () => {
    const input = `// header
{
  "a": 1 // inline
  /* block */
}`;
    const result = stripJsonComments(input);
    expect(result).not.toContain("// header");
    expect(result).not.toContain("// inline");
    expect(result).not.toContain("/* block */");
    expect(result).toContain('"a": 1');
  });

  it("leaves valid JSON unchanged", () => {
    const valid = '{"foo": "bar", "baz": [1, 2, 3]}';
    expect(stripJsonComments(valid)).toBe(valid);
  });
});

const Item = z.object({ id: z.string(), n: z.number() });
const byId = { idOf: (item: { id: string }) => item.id, label: "Item" };

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "jsonc-"));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
  return dir;
}

afterEach(() => vi.restoreAllMocks());

describe("loadJsoncDir", () => {
  it("parses .json and .jsonc files in name order, comments allowed", async () => {
    const dir = await dirWith({
      "b.jsonc": '// two\n{ "id": "b", "n": 2 }',
      "a.json": '{ "id": "a", "n": 1 }',
      "notes.txt": "ignored",
    });
    const items = await loadJsoncDir(dir, Item, byId);
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("skips a file that fails the schema, with a warning, when onInvalid is skip", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = await dirWith({ "bad.json": '{ "id": "x" }', "ok.json": '{ "id": "y", "n": 1 }' });
    expect(await loadJsoncDir(dir, Item, { ...byId, onInvalid: "skip" })).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Item] Skipping bad.json"));
  });

  it("skips a file that is not JSON, with a warning, when onInvalid is skip", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = await dirWith({ "broken.json": "{" });
    expect(await loadJsoncDir(dir, Item, { ...byId, onInvalid: "skip" })).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Item] Skipping broken.json"));
  });

  it("throws on a file that is not JSON by default, naming the file", async () => {
    const dir = await dirWith({ "broken.json": "{" });
    await expect(loadJsoncDir(dir, Item, byId)).rejects.toThrow(
      `[Item] Invalid JSON in ${join(dir, "broken.json")}`,
    );
  });

  it("throws on a schema failure by default, naming the file and the entry path", async () => {
    const dir = await dirWith({ "bad.json": '{ "id": "x" }' });
    await expect(loadJsoncDir(dir, Item, byId)).rejects.toThrow(
      `[Item] ${join(dir, "bad.json")} failed validation`,
    );
    // prettifyError names the failing entry ("→ at n").
    await expect(loadJsoncDir(dir, Item, byId)).rejects.toThrow("at n");
  });

  it("refuses a directory above maxFiles", async () => {
    const dir = await dirWith({
      "a.json": '{ "id": "a", "n": 1 }',
      "b.json": '{ "id": "b", "n": 2 }',
    });
    await expect(loadJsoncDir(dir, Item, { ...byId, maxFiles: 1 })).rejects.toThrow(
      "[Item] 2 content files in ",
    );
    await expect(loadJsoncDir(dir, Item, { ...byId, maxFiles: 1 })).rejects.toThrow(
      "exceed the maximum of 1",
    );
  });

  it("refuses a file above maxFileBytes", async () => {
    const dir = await dirWith({ "big.json": '{ "id": "a", "n": 1 }' });
    await expect(loadJsoncDir(dir, Item, { ...byId, maxFileBytes: 5 })).rejects.toThrow(
      "[Item] big.json is",
    );
    await expect(loadJsoncDir(dir, Item, { ...byId, maxFileBytes: 5 })).rejects.toThrow(
      "larger than the maximum of 5 bytes",
    );
  });

  it("ignores a symlinked .jsonc file", async (ctx) => {
    const dir = await dirWith({ "real.json": '{ "id": "a", "n": 1 }' });
    const outside = await mkdtemp(join(tmpdir(), "jsonc-outside-"));
    await writeFile(join(outside, "linked.jsonc"), '{ "id": "b", "n": 2 }');
    try {
      await symlink(join(outside, "linked.jsonc"), join(dir, "linked.jsonc"));
    } catch {
      ctx.skip("symlinks not permitted on this machine");
    }
    expect((await loadJsoncDir(dir, Item, byId)).map((item) => item.id)).toEqual(["a"]);
  });

  it("ignores a subdirectory with a content-looking name", async () => {
    const dir = await dirWith({ "real.json": '{ "id": "a", "n": 1 }' });
    await mkdir(join(dir, "nested.jsonc"));
    expect((await loadJsoncDir(dir, Item, byId)).map((item) => item.id)).toEqual(["a"]);
  });

  it("refuses a duplicate id", async () => {
    const dir = await dirWith({
      "a.json": '{ "id": "x", "n": 1 }',
      "b.json": '{ "id": "x", "n": 2 }',
    });
    await expect(loadJsoncDir(dir, Item, byId)).rejects.toThrow('Duplicate Item id "x" in b.json');
  });

  it("names a missing directory", async () => {
    await expect(loadJsoncDir(join(tmpdir(), "no-such-dir-xyz"), Item, byId)).rejects.toThrow(
      "Item directory not found",
    );
  });
});

describe("loadJsoncDirWithFiles", () => {
  it("returns each item with the file it came from, in name order", async () => {
    const dir = await dirWith({
      "b.json": '{ "id": "b", "n": 2 }',
      "a.jsonc": '// a comment\n{ "id": "a", "n": 1 }',
    });
    expect(await loadJsoncDirWithFiles(dir, Item, byId)).toEqual([
      { file: "a.jsonc", value: { id: "a", n: 1 } },
      { file: "b.json", value: { id: "b", n: 2 } },
    ]);
  });

  it("throws like loadJsoncDir on a duplicate id, naming the file", async () => {
    const dir = await dirWith({
      "a.json": '{ "id": "x", "n": 1 }',
      "b.json": '{ "id": "x", "n": 2 }',
    });
    await expect(loadJsoncDirWithFiles(dir, Item, byId)).rejects.toThrow(
      'Duplicate Item id "x" in b.json',
    );
  });
});

describe("loadJsoncFile", () => {
  it("returns the validated value, comments allowed", async () => {
    const dir = await dirWith({ "a.jsonc": '// a comment\n{ "id": "a", "n": 1 }' });
    expect(await loadJsoncFile(join(dir, "a.jsonc"), Item, byId)).toEqual({ id: "a", n: 1 });
  });

  it("throws on a missing file, naming the file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jsonc-"));
    await expect(loadJsoncFile(join(dir, "nope.json"), Item, byId)).rejects.toThrow(
      `[Item] File not found: ${join(dir, "nope.json")}`,
    );
  });

  it("throws on invalid JSON like the directory loader", async () => {
    const dir = await dirWith({ "broken.json": "{" });
    await expect(loadJsoncFile(join(dir, "broken.json"), Item, byId)).rejects.toThrow(
      `[Item] Invalid JSON in ${join(dir, "broken.json")}`,
    );
  });

  it("throws on a schema failure like the directory loader", async () => {
    const dir = await dirWith({ "bad.json": '{ "id": "x" }' });
    await expect(loadJsoncFile(join(dir, "bad.json"), Item, byId)).rejects.toThrow(
      `[Item] ${join(dir, "bad.json")} failed validation`,
    );
  });

  it("throws on a file above maxFileBytes like the directory loader", async () => {
    const dir = await dirWith({ "big.json": '{ "id": "a", "n": 1 }' });
    await expect(
      loadJsoncFile(join(dir, "big.json"), Item, { ...byId, maxFileBytes: 5 }),
    ).rejects.toThrow(`[Item] ${join(dir, "big.json")} is larger than the maximum of 5 bytes`);
  });
});

describe("contentDirFrom", () => {
  it("returns the override when set", () => {
    expect(contentDirFrom("/somewhere", "file:///game/server.ts", "./content")).toBe("/somewhere");
  });

  it("resolves the folder next to the entry file when unset", () => {
    const entry = pathToFileURL(join(tmpdir(), "game", "server.ts")).href;
    expect(contentDirFrom(undefined, entry, "./content")).toBe(join(tmpdir(), "game", "content"));
  });

  it("treats an empty-string override as set, keeping ?? semantics", () => {
    expect(contentDirFrom("", "file:///game/server.ts", "./content")).toBe("");
  });
});
