#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseCreateArgs, runCreate } from "./create.js";

const [command, ...rest] = process.argv.slice(2);
if (command !== "create") {
  console.error('Usage: partygame create <slug> [--name "Display Name"]');
  process.exit(2);
}
const args = parseCreateArgs(rest);
if (!args.ok) {
  console.error(args.error);
  process.exit(2);
}
const templateDir = fileURLToPath(new URL("../template", import.meta.url));
const install = (root: string): number =>
  spawnSync("bun", ["install"], { cwd: root, stdio: "inherit" }).status ?? 1;
process.exit(
  await runCreate({
    slug: args.slug,
    ...(args.name === undefined ? {} : { name: args.name }),
    cwd: process.cwd(),
    templateDir,
    install,
  }),
);
