import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkAgentsFiles, type PackageDescription } from "./checkAgentsFiles.js";

const root = join(import.meta.dirname, "..");
const read = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, "utf8") : undefined;

const rootJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  workspaces: string[];
};

const packages: PackageDescription[] = [];
for (const glob of rootJson.workspaces) {
  const parent = glob.replace(/\/\*$/, "");
  for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
    const dir = `${parent}/${entry.name}`;
    const json = read(join(root, dir, "package.json"));
    if (!entry.isDirectory() || json === undefined) continue;
    packages.push({
      dir,
      packageJson: JSON.parse(json),
      agentsMd: read(join(root, dir, "AGENTS.md")),
    });
  }
}

const violations = checkAgentsFiles(packages);
for (const violation of violations) console.error(violation);
process.exit(violations.length > 0 ? 1 : 0);
