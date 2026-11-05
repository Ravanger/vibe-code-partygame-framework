import type { Prompter } from "./Prompter.js";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A prompter that records what it was asked and waits for the test to answer. */
export class ScriptedIo implements Prompter {
  readonly asked: string[] = [];
  readonly printed: string[] = [];
  readonly signals: AbortSignal[] = [];
  private waiting: ((text: string) => void) | undefined;

  /** Records the question and signal, then waits for `type` to answer it. */
  ask(question: string, signal: AbortSignal): Promise<string> {
    this.asked.push(question);
    this.signals.push(signal);
    return new Promise((resolve, reject) => {
      this.waiting = resolve;
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }

  /** Records `line` in `printed`. */
  print(line: string): void {
    this.printed.push(line);
  }

  /** Types `text` into the pending question and lets the player react. */
  async type(text: string): Promise<void> {
    const resolve = this.waiting;
    this.waiting = undefined;
    resolve?.(text);
    await tick();
    await tick();
  }

  /** Whether a question is waiting for `type`. */
  get isWaiting(): boolean {
    return this.waiting !== undefined;
  }

  /** The most recent question asked, or an empty string when none was. */
  get lastQuestion(): string {
    return this.asked[this.asked.length - 1] ?? "";
  }
}
