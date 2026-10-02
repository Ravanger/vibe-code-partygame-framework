import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { loadJsoncDir, stripJsonComments } from "../src/content.js";

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

  it("skips a file that fails the schema, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = await dirWith({ "bad.json": '{ "id": "x" }', "ok.json": '{ "id": "y", "n": 1 }' });
    expect(await loadJsoncDir(dir, Item, byId)).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Item] Skipping bad.json"));
  });

  it("skips a file that is not JSON, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dir = await dirWith({ "broken.json": "{" });
    expect(await loadJsoncDir(dir, Item, byId)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[Item] Skipping broken.json"));
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
