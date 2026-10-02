import { PlayerSchema } from "@partygame/shared/schema";
import {
  Answer,
  CategoryOption,
  Matchup,
  PlayerPrivate,
  PromptAssignment,
  ScoreEntry,
  type WitClashState,
} from "../../src/state.js";
import type { Prompter } from "../../terminal/Prompter.js";

export const ME = "me-0000001";

export { freePort } from "@partygame/server/node";

export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const seat = (
  state: WitClashState,
  id: string,
  name = id,
  role: "host" | "player" = "player",
): void => {
  state.players.set(id, Object.assign(new PlayerSchema(), { id, name, role }));
};

export const option = (id: string, votes = 0): CategoryOption =>
  Object.assign(new CategoryOption(), { id, name: `Name ${id}`, votes });

export const answer = (id: string, text: string, over: Partial<Answer> = {}): Answer =>
  Object.assign(new Answer(), { id, text, ...over });

export const matchup = (
  id: string,
  promptText: string,
  answers: Answer[],
  over: Partial<Matchup> = {},
): Matchup => {
  const made = Object.assign(new Matchup(), { id, promptText, ...over });
  for (const each of answers) made.answers.push(each);
  return made;
};

export const prompt = (matchupId: string, promptText: string, submitted = false) =>
  Object.assign(new PromptAssignment(), { matchupId, promptText, submitted });

export const mine = (
  state: WitClashState,
  id: string,
  over: Partial<PlayerPrivate> = {},
  prompts: PromptAssignment[] = [],
): PlayerPrivate => {
  const entry = Object.assign(new PlayerPrivate(), over);
  for (const each of prompts) entry.prompts.push(each);
  state.mine.set(id, entry);
  return entry;
};

export const row = (
  playerId: string,
  name: string,
  score: number,
  over: Partial<ScoreEntry> = {},
): ScoreEntry => Object.assign(new ScoreEntry(), { playerId, name, score, ...over });

/** A prompter that records what it was asked and waits for the test to answer. */
export class ScriptedIo implements Prompter {
  readonly asked: string[] = [];
  readonly printed: string[] = [];
  readonly signals: AbortSignal[] = [];
  private waiting: ((text: string) => void) | undefined;

  ask(question: string, signal: AbortSignal): Promise<string> {
    this.asked.push(question);
    this.signals.push(signal);
    return new Promise((resolve, reject) => {
      this.waiting = resolve;
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }

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

  get isWaiting(): boolean {
    return this.waiting !== undefined;
  }

  get lastQuestion(): string {
    return this.asked[this.asked.length - 1] ?? "";
  }
}
