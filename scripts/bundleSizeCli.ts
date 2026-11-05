import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  budgetProblems,
  formatTable,
  listClientGames,
  readBundle,
  summarize,
} from "./bundleSize.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const named = args.find((arg) => !arg.startsWith("--"));
const games = named === undefined ? listClientGames(join(root, "games")) : [named];

const totals: Record<string, number> = {};
for (const game of games) {
  const dist = join(root, "games", game, "dist");
  if (!existsSync(dist)) {
    console.error(`No bundle at ${dist}; run the game's build first.`);
    process.exit(1);
  }
  const files = readBundle(dist);
  console.log(`${game}:`);
  console.log(formatTable(files));
  totals[game] = summarize(files).totalGzipBytes;
}

if (check) {
  const budget = JSON.parse(
    readFileSync(join(root, "scripts", "bundle-budget.json"), "utf8"),
  ) as Record<string, { gzipBytes: number }>;
  const problems = budgetProblems(totals, budget);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  for (const [game, total] of Object.entries(totals)) {
    console.log(`${game} within budget: ${total} <= ${budget[game]?.gzipBytes} gzip bytes.`);
  }
}
