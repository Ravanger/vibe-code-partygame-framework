import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { codeChanged, mutateTargets, strykerArgs } from "./mutateChanged.js";

const [flag, ref] = process.argv.slice(2);
if (flag !== "--base" || !ref) {
  console.error("usage: mutateChangedCli.ts --base <ref>");
  process.exit(2);
}

const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=d", `${ref}...HEAD`], {
  encoding: "utf8",
});
const mergeBase = execFileSync("git", ["merge-base", ref, "HEAD"], { encoding: "utf8" }).trim();
const baseSource = (path: string): string | undefined => {
  try {
    return execFileSync("git", ["show", `${mergeBase}:${path}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
};
const changed = mutateTargets(output);
const targets = changed.filter((path) => codeChanged(baseSource(path), readFileSync(path, "utf8")));
console.log(
  `mutation: ${changed.length} changed source file(s), ${changed.length - targets.length} comment-only skipped`,
);
if (targets.length === 0) {
  console.log("mutation: no changed source files");
  process.exit(0);
}
console.log(`mutation: ${targets.length} with code changes`);
execFileSync("bunx", ["stryker", ...strykerArgs(targets)], { stdio: "inherit", shell: true });
