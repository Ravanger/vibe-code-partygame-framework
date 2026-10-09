import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkGates, diffRange, labelsOf, NO_TEST_LABEL, OVERRIDE_LABEL } from "./checkGates.js";

const args = process.argv.slice(2);
const eventPath = process.env.GITHUB_EVENT_PATH;
const labels = eventPath ? labelsOf(JSON.parse(readFileSync(eventPath, "utf8"))) : [];
const diff = execFileSync("git", ["diff", "-U0", "--no-color", ...diffRange(args)], {
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
});

const violations = checkGates(diff, labels, !args.includes("--staged"));
for (const violation of violations) {
  console.error(`${violation.path}: ${violation.rule}: ${violation.detail}`);
}
if (violations.length > 0) {
  console.error(
    `Gate edits need the "${OVERRIDE_LABEL}" PR label; src without a test needs "${NO_TEST_LABEL}".`,
  );
}
process.exit(violations.length === 0 ? 0 : 1);
