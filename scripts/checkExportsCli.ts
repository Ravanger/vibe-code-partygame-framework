import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCurrent, checkExports, type Snapshot } from "./checkExports.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const snapshotPath = join(root, "scripts", "exports.snapshot.json");

const previous: Snapshot = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, "utf8"))
  : { knownViolations: [], packages: {} };
const current = buildCurrent(root, previous);

if (process.argv.includes("--update")) {
  const stripped = Object.fromEntries(
    Object.entries(current).map(([pkg, entries]) => [
      pkg,
      Object.fromEntries(
        Object.entries(entries).map(([subpath, entry]) => [
          subpath,
          {
            ...entry,
            symbols: Object.fromEntries(
              Object.entries(entry.symbols).map(([name, info]) => [
                name,
                info.experimental ? { experimental: true as const } : {},
              ]),
            ),
          },
        ]),
      ),
    ]),
  );
  const next: Snapshot = { knownViolations: previous.knownViolations, packages: stripped };
  writeFileSync(snapshotPath, `${JSON.stringify(next, null, 2)}\n`);
  process.exit(0);
}

const problems = checkExports(current, previous);
for (const problem of problems) console.error(problem);
process.exit(problems.length === 0 ? 0 : 1);
