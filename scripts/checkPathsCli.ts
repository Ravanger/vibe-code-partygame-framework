import { execFileSync } from "node:child_process";
import { checkPaths, parseNameStatus } from "./checkPaths.js";

const [flag, ref] = process.argv.slice(2);
const range =
  flag === "--staged" ? ["--cached"] : flag === "--base" && ref ? [`${ref}...HEAD`] : [];
if (range.length === 0) {
  console.error("usage: checkPathsCli.ts --staged | --base <ref>");
  process.exit(2);
}

const output = execFileSync("git", ["diff", "--name-status", ...range], { encoding: "utf8" });
const violations = checkPaths(parseNameStatus(output));
for (const v of violations) {
  console.error(`${v.path}: ${v.message}`);
}
process.exit(violations.length > 0 ? 1 : 0);
