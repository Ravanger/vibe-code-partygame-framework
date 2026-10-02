import type { Interface } from "node:readline/promises";

/** The player's screen and keyboard. `ask` rejects when `signal` aborts. */
export interface Prompter {
  ask(question: string, signal: AbortSignal): Promise<string>;
  print(line: string): void;
}

/** A {@link Prompter} on a readline interface; `print` redraws the pending question and the text typed so far. */
export class ReadlinePrompter implements Prompter {
  private pending = "";

  constructor(
    private readonly lines: Interface,
    private readonly out: NodeJS.WritableStream = process.stdout,
  ) {}

  async ask(question: string, signal: AbortSignal): Promise<string> {
    const prompt = question.slice(question.lastIndexOf("\n") + 1);
    if (question.includes("\n")) this.out.write(question.slice(0, -prompt.length));
    this.pending = prompt;
    try {
      return await this.lines.question(prompt, { signal });
    } finally {
      if (this.pending === prompt) this.pending = "";
    }
  }

  print(line: string): void {
    this.out.write(`\r\x1b[K${line}\n${this.pending}${this.pending ? this.lines.line : ""}`);
  }
}
