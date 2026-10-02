/** The player's screen and keyboard. `ask` rejects when `signal` aborts. */
export interface Prompter {
  ask(question: string, signal: AbortSignal): Promise<string>;
  print(line: string): void;
}
