import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
          name: relative(dir, path).split(sep).join("/"),
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

/** Games under `gamesDir` that ship a browser client: an `index.html` and a `ui/` directory. */
export const listClientGames = (gamesDir: string): string[] =>
  readdirSync(gamesDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(gamesDir, entry.name, "index.html")) &&
        existsSync(join(gamesDir, entry.name, "ui")),
    )
    .map((entry) => entry.name)
    .sort();

/** One message per game that has no budget entry or whose gzip total is over its budget. */
export const budgetProblems = (
  gzipTotals: Record<string, number>,
  budget: Record<string, { gzipBytes: number }>,
): string[] =>
  Object.entries(gzipTotals).flatMap(([game, total]) => {
    const limit = budget[game]?.gzipBytes;
    if (limit === undefined)
      return [`No budget recorded for ${game} in scripts/bundle-budget.json.`];
    return withinBudget(total, limit)
      ? []
      : [
          `${game} gzip total ${total} exceeds the budget of ${limit}; see docs/framework/README.md (Bundle size).`,
        ];
  });
