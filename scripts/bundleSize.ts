import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

/** One emitted bundle file with its measured sizes. */
export interface BundleFile {
  name: string;
  bytes: number;
  gzipBytes: number;
}

/** Total raw and gzipped size of a bundle's files. */
export const summarize = (files: BundleFile[]): { totalBytes: number; totalGzipBytes: number } =>
  files.reduce(
    (sum, file) => ({
      totalBytes: sum.totalBytes + file.bytes,
      totalGzipBytes: sum.totalGzipBytes + file.gzipBytes,
    }),
    { totalBytes: 0, totalGzipBytes: 0 },
  );

/** One line per file, heaviest first, plus a totals line. */
export const formatTable = (files: BundleFile[]): string => {
  const rows = [...files]
    .sort((a, b) => b.bytes - a.bytes)
    .map((file) => `${file.name}\t${file.bytes}\t${file.gzipBytes}`);
  const { totalBytes, totalGzipBytes } = summarize(files);
  return ["name\tbytes\tgzip", ...rows, `total\t${totalBytes}\t${totalGzipBytes}`].join("\n");
};

/** Every `.js` and `.css` file under `dir` (recursive), with measured gzip sizes; names are relative to `dir`. */
export const readBundle = (dir: string): BundleFile[] => {
  const files: BundleFile[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".css")) {
        const content = readFileSync(path);
        files.push({
          name: relative(dir, path),
          bytes: content.length,
          gzipBytes: gzipSync(content).length,
        });
      }
    }
  };
  walk(dir);
  return files;
};

/** True when the bundle's gzip total is at or under budget. */
export const withinBudget = (totalGzipBytes: number, budgetGzipBytes: number): boolean =>
  totalGzipBytes <= budgetGzipBytes;
