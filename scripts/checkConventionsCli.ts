import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkConventions, type TextFile } from "./checkConventions.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter((path) => path !== "");

const files: TextFile[] = tracked.flatMap((path) => {
  const text = readFileSync(`${root}${path}`, "utf8");
  return text.includes("\0") ? [] : [{ path, text }];
});

const violations = checkConventions(files);
for (const violation of violations) {
  console.error(`${violation.path}:${violation.line}: ${violation.rule}: ${violation.message}`);
}
process.exit(violations.length === 0 ? 0 : 1);
