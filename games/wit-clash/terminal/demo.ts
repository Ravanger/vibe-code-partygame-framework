import { contentDir, loadContent } from "../src/loadContent.js";
import { CliArgs } from "./CliArgs.js";
import { witClashDemo } from "./witClashDemo.js";

const parsed = new CliArgs().demo(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const categories = await loadContent(
  contentDir(process.env, new URL("../server.ts", import.meta.url).href),
);
const passed = await witClashDemo({ ...parsed.value, categories, out: console.log }).run();
process.exit(passed ? 0 : 1);
