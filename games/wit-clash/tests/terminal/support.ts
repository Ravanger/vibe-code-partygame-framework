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
