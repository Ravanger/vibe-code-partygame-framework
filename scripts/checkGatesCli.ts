import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkGates,
  diffRange,
  isScannedPath,
  labelsOf,
  NO_TEST_LABEL,
  OVERRIDE_LABEL,
  scanTree,
  trustedLabels,
} from "./checkGates.js";

const args = process.argv.slice(2);
const eventPath = process.env.GITHUB_EVENT_PATH;
const argValue = (flag: string): string | undefined => args[args.indexOf(flag) + 1];
const eventsPath = args.includes("--label-events") ? argValue("--label-events") : undefined;
const owner = args.includes("--label-owner") ? argValue("--label-owner") : undefined;
const event = eventPath ? JSON.parse(readFileSync(eventPath, "utf8")) : undefined;
const labels =
  eventsPath && owner
    ? trustedLabels(event, JSON.parse(readFileSync(eventsPath, "utf8")), owner)
    : labelsOf(event);
const diff = execFileSync("git", ["diff", "-U10000", "--no-color", ...diffRange(args)], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});

// The file list comes from the PR work tree, so reads must resolve against it too.
const workTree = process.env.GIT_WORK_TREE ?? ".";

const staged = args.includes("--staged");
const treeFiles = staged
  ? []
  : execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .filter((path) => path !== "" && isScannedPath(path))
      .map((path) => ({ path, content: readFileSync(join(workTree, path), "utf8") }));

const violations = [...checkGates(diff, labels, !staged), ...scanTree(treeFiles)];
for (const violation of violations) {
  console.error(`${violation.path}: ${violation.rule}: ${violation.detail}`);
}
if (violations.length > 0) {
  console.error(
    `Gate edits need the "${OVERRIDE_LABEL}" PR label; src without a test needs "${NO_TEST_LABEL}".`,
  );
}
process.exit(violations.length === 0 ? 0 : 1);
