import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  checkGates,
  diffRange,
  labelsOf,
  NO_TEST_LABEL,
  OVERRIDE_LABEL,
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
