import { createInterface, type Interface } from "node:readline/promises";
import { contentDir, loadContent } from "../src/loadContent.js";
import { CliArgs } from "./CliArgs.js";
import { PlaySession } from "./PlaySession.js";
import type { Prompter } from "./Prompter.js";

class ReadlinePrompter implements Prompter {
  private pending = "";

  constructor(private readonly lines: Interface) {}

  async ask(question: string, signal: AbortSignal): Promise<string> {
    const prompt = question.slice(question.lastIndexOf("\n") + 1);
    if (question.includes("\n")) process.stdout.write(`${question.slice(0, -prompt.length)}`);
    this.pending = prompt;
    try {
      return await this.lines.question(prompt, { signal });
    } finally {
      if (this.pending === prompt) this.pending = "";
    }
  }

  print(line: string): void {
    process.stdout.write(`\r\x1b[K${line}\n${this.pending}${this.pending ? this.lines.line : ""}`);
  }
}

const parsed = new CliArgs().play(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}

const categories = await loadContent(
  contentDir(process.env, new URL("../server.ts", import.meta.url).href),
);
const lines = createInterface({ input: process.stdin, output: process.stdout });
const { usesDefaults, join } = parsed.value;
const session = new PlaySession(
  {
    ...parsed.value,
    startServer: usesDefaults && join === undefined,
    categories,
    bot: {},
    clientUrl: "http://localhost:5173",
  },
  new ReadlinePrompter(lines),
);
lines.on("SIGINT", () => session.stop());
lines.on("close", () => session.stop());
process.on("SIGINT", () => session.stop());

let code = 0;
try {
  await session.run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  code = 1;
}
lines.close();
process.exit(code);
