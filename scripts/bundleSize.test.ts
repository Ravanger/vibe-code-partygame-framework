import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { formatTable, readBundle, summarize, withinBudget } from "./bundleSize.js";

describe("summarize", () => {
  it("adds up raw and gzip sizes", () => {
    expect(
      summarize([
        { name: "a.js", bytes: 100, gzipBytes: 40 },
        { name: "b.css", bytes: 50, gzipBytes: 20 },
      ]),
    ).toEqual({ totalBytes: 150, totalGzipBytes: 60 });
  });

  it("is zero for an empty bundle", () => {
    expect(summarize([])).toEqual({ totalBytes: 0, totalGzipBytes: 0 });
  });
});

describe("formatTable", () => {
  it("lists files heaviest first with a totals line", () => {
    expect(
      formatTable([
        { name: "small.js", bytes: 10, gzipBytes: 5 },
        { name: "big.js", bytes: 100, gzipBytes: 40 },
      ]),
    ).toBe("name\tbytes\tgzip\nbig.js\t100\t40\nsmall.js\t10\t5\ntotal\t110\t45");
  });

  it("is just the header and zero totals for an empty bundle", () => {
    expect(formatTable([])).toBe("name\tbytes\tgzip\ntotal\t0\t0");
  });
});

describe("readBundle", () => {
  const dir = mkdtempSync(join(tmpdir(), "bundle-"));

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads .js and .css files recursively with gzip sizes, skipping other files", () => {
    writeFileSync(join(dir, "index.js"), "x".repeat(120));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "index.css"), ".a{color:red}\n".repeat(10));
    writeFileSync(join(dir, "assets", "logo.svg"), "<svg/>");
    writeFileSync(join(dir, "index.js.map"), "{}");
    mkdirSync(join(dir, "chunks"));
    writeFileSync(join(dir, "chunks", "x.js"), "y".repeat(64));

    const files = readBundle(dir);
    expect(files.map((file) => file.name).sort()).toEqual([
      "assets/index.css",
      "chunks/x.js",
      "index.js",
    ]);
    for (const file of files) {
      expect(file.bytes).toBeGreaterThan(0);
      expect(file.gzipBytes).toBeLessThanOrEqual(file.bytes);
    }
    expect(files.find((file) => file.name === "index.js")?.bytes).toBe(120);
  });

  it("is empty for an empty directory", () => {
    const empty = mkdtempSync(join(tmpdir(), "bundle-empty-"));
    try {
      expect(readBundle(empty)).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("withinBudget", () => {
  it("passes at or under the budget and fails over it", () => {
    expect(withinBudget(99, 100)).toBe(true);
    expect(withinBudget(100, 100)).toBe(true);
    expect(withinBudget(101, 100)).toBe(false);
  });
});
