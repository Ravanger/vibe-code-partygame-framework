import {
  type ConnectedClient,
  connectedClient as connectedClientOf,
  type FetchStub,
  fakeFetch,
  type SeatConfig,
} from "@partygame/game-client/testing";

export { addSeat, type FetchStub, type SeatConfig } from "@partygame/game-client/testing";

import { vi } from "vitest";
import { ROOM_NAME } from "../../src/roomName.js";
import {
  Answer,
  CategoryOption,
  Matchup,
  PlayerPrivate,
  PromptAssignment,
  ScoreEntry,
  WitClashState,
} from "../../src/state.js";

export function addMine(
  state: WitClashState,
  id: string,
  over: Partial<PlayerPrivate> = {},
): PlayerPrivate {
  const mine = Object.assign(new PlayerPrivate(), over);
  state.mine.set(id, mine);
  return mine;
}

export function prompt(matchupId: string, promptText: string, submitted = false): PromptAssignment {
  return Object.assign(new PromptAssignment(), { matchupId, promptText, submitted });
}

export function option(id: string, votes = 0): CategoryOption {
  return Object.assign(new CategoryOption(), { id, name: `Name ${id}`, emoji: "E", votes });
}

export function answer(id: string, text: string, over: Partial<Answer> = {}): Answer {
  return Object.assign(new Answer(), { id, text, ...over });
}

export function matchup(
  id: string,
  promptText: string,
  answers: Answer[],
  over: Partial<Matchup> = {},
): Matchup {
  const made = Object.assign(new Matchup(), { id, promptText, ...over });
  for (const a of answers) made.answers.push(a);
  return made;
}

export function scoreRow(
  playerId: string,
  score: number,
  over: Partial<ScoreEntry> = {},
): ScoreEntry {
  return Object.assign(new ScoreEntry(), { playerId, name: playerId, score, ...over });
}

export type Client = ConnectedClient<WitClashState>;

/** A manager attached to an in-memory room whose state is a real WitClashState with this client seated. */
export const connectedClient = (seat: SeatConfig = {}, phase = "Lobby"): Client =>
  connectedClientOf({
    stateClass: WitClashState,
    roomName: ROOM_NAME,
    seat,
    phase,
    setup: (state) => {
      state.minPlayers = 3;
      state.maxPlayers = 8;
      state.options = JSON.stringify({ totalRounds: 3 });
    },
  });

/** The requests a client sent, leaving out the typing indicator that rides along with every answer. */
export function withoutTyping(c: Client): Client["room"]["requests"] {
  return c.room.requests.filter(
    (r) => !(typeof r.payload === "object" && r.payload !== null && "typing" in r.payload),
  );
}

/** Stands in for the network: records every requested URL and answers with `reply` (an Error or a string rejects). */
export function stubFetch(reply: unknown): FetchStub {
  const stub = fakeFetch(reply);
  vi.stubGlobal("fetch", stub.fetch);
  return stub;
}
