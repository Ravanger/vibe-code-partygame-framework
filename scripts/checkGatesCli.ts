import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkGates, diffRange, labelsOf, OVERRIDE_LABEL } from "./checkGates.js";

const eventPath = process.env.GITHUB_EVENT_PATH;
const labels = eventPath ? labelsOf(JSON.parse(readFileSync(eventPath, "utf8"))) : [];
const diff = execFileSync(
  "git",
  ["diff", "-U0", "--no-color", ...diffRange(process.argv.slice(2))],
  {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  },
);

const violations = checkGates(diff, labels);
for (const violation of violations) {
  console.error(`${violation.path}: ${violation.rule}: ${violation.detail}`);
}
if (violations.length > 0) console.error(`Gate edits need the "${OVERRIDE_LABEL}" PR label.`);
process.exit(violations.length === 0 ? 0 : 1);
