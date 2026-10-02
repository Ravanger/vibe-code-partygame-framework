import type { Room } from "@colyseus/core";
import {
  bootTestServer,
  joinPlayer,
  seatPlayers,
  sleep,
  stateOf,
  type TestPlayer,
  type TestServer,
  testPlayerId,
  waitUntil,
} from "@partygame/server/testing";
import { createWitClashGame } from "../../src/game.js";
import { ROOM_NAME } from "../../src/roomName.js";
import { WitClashState } from "../../src/state.js";
import { makeCategories } from "./support.js";

export const ROOM = ROOM_NAME;
export { testPlayerId as pid };

export type Seated = TestPlayer<WitClashState>;

export const bootWitClash = (reconnectMs = 1000): Promise<TestServer> =>
  bootTestServer({
    games: [
      {
        roomName: ROOM,
        definition: createWitClashGame({ categories: makeCategories() }),
        stateClass: WitClashState,
      },
    ],
    reconnectMs,
  });

export const serverState = (room: Room): WitClashState => stateOf(room, WitClashState);

export const join = (t: TestServer, room: Room, n: number): Promise<Seated> =>
  joinPlayer(t, room, n, WitClashState);

/** Joins and names one player. */
export async function seat(t: TestServer, room: Room, n: number): Promise<Seated> {
  const who = await join(t, room, n);
  who.setName();
  return who;
}

/** Joins and names `count` players; the first (the host) then presses Start unless `start` is false. */
export const seatAll = (
  t: TestServer,
  room: Room,
  count: number,
  start = true,
): Promise<Seated[]> => seatPlayers(t, room, { stateClass: WitClashState, count, start });

export async function voteCategory(room: Room, players: Seated[]): Promise<void> {
  await waitUntil(() => serverState(room).phase === "CategorySelection", "category vote");
  const categoryId = serverState(room).categoryOptions[0]?.id;
  for (const p of players) p.act("VOTE_CATEGORY", { categoryId });
  await waitUntil(() => serverState(room).phase === "Prompting", "prompting");
}

/** Reads each player's prompts from their own client, as a real UI would. */
export async function answerAll(room: Room, players: Seated[]): Promise<void> {
  for (const p of players) {
    await waitUntil(
      () => p.client.state.mine?.get(p.playerId)?.prompts?.length === 2,
      `prompts of ${p.n}`,
    );
    for (const prompt of p.client.state.mine.get(p.playerId)?.prompts ?? []) {
      p.act("SUBMIT_ANSWER", { matchupId: prompt.matchupId, answer: `answer ${p.n}` });
    }
  }
  await waitUntil(() => serverState(room).phase === "MatchupVoting", "voting");
}

/** Votes for the first answer of every matchup until the round ends. */
export async function playVoting(room: Room, players: Seated[]): Promise<void> {
  const state = serverState(room);
  while (state.phase !== "Results") {
    await waitUntil(
      () => state.phase === "Results" || state.phase === "MatchupVoting",
      "next vote",
    );
    if (state.phase === "MatchupVoting") {
      const index = state.activeMatchupIndex;
      const answerId = state.matchups[index]?.answers[0]?.id;
      for (const p of players)
        if (state.mine.get(p.playerId)?.canVote) p.act("CAST_VOTE", { answerId });
      await waitUntil(
        () => state.phase !== "MatchupVoting" || state.activeMatchupIndex !== index,
        "voted",
      );
    }
    await sleep(10);
  }
}
