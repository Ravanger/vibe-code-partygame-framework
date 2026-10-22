import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatTable, readBundle, summarize, withinBudget } from "./bundleSize.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const game = args.find((arg) => !arg.startsWith("--")) ?? "wit-clash";
const dist = join(root, "games", game, "dist");

if (!existsSync(dist)) {
  console.error(`No bundle at ${dist}; run the game's build first.`);
  process.exit(1);
}

console.log(`${game}:`);
console.log(formatTable(readBundle(dist)));

if (check) {
  const budget = JSON.parse(
    readFileSync(join(root, "scripts", "bundle-budget.json"), "utf8"),
  ) as Record<string, { gzipBytes: number }>;
  const limit = budget[game]?.gzipBytes;
  if (limit === undefined) {
    console.error(`No budget recorded for ${game} in scripts/bundle-budget.json.`);
    process.exit(1);
  }
  const { totalGzipBytes } = summarize(readBundle(dist));
  if (!withinBudget(totalGzipBytes, limit)) {
    console.error(
      `${game} gzip total ${totalGzipBytes} exceeds the budget of ${limit}; see docs/framework/README.md (Bundle size).`,
    );
    process.exit(1);
  }
  console.log(`Within budget: ${totalGzipBytes} <= ${limit} gzip bytes.`);
}
