import { execFileSync } from "node:child_process";
import { mutateTargets, strykerArgs } from "./mutateChanged.js";

const [flag, ref] = process.argv.slice(2);
if (flag !== "--base" || !ref) {
  console.error("usage: mutateChangedCli.ts --base <ref>");
  process.exit(2);
}

const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=d", `${ref}...HEAD`], {
  encoding: "utf8",
});
const targets = mutateTargets(output);
if (targets.length === 0) {
  console.log("mutation: no changed source files");
  process.exit(0);
}
console.log(`mutation: ${targets.length} changed source file(s)`);
execFileSync("bunx", ["stryker", ...strykerArgs(targets)], { stdio: "inherit", shell: true });
