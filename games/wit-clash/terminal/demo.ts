import { contentDir, loadContent } from "../src/loadContent.js";
import { CliArgs } from "./CliArgs.js";
import { DemoRun } from "./DemoRun.js";

const parsed = new CliArgs().demo(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const categories = await loadContent(
  contentDir(process.env, new URL("../server.ts", import.meta.url).href),
);
const passed = await new DemoRun({
  ...parsed.value,
  categories,
  out: console.log,
  answerDelayMs: [800, 2500],
  voteDelayMs: [500, 1500],
  revealSeconds: 2,
}).run();
process.exit(passed ? 0 : 1);
