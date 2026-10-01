import type { Room } from "@colyseus/core";
import type { Room as ClientRoom } from "@colyseus/sdk";
import {
  bootTestServer,
  collectMessages,
  sleep,
  type TestServer,
  waitUntil,
} from "@partygame/server/testing";
import { createWitClashGame } from "../../src/game.js";
import { WitClashState } from "../../src/state.js";
import { makeCategories } from "./support.js";

export const ROOM = "wit_clash";
export const pid = (n: number): string => `player-000${n}`;

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

export const serverState = (room: Room): WitClashState => room.state as WitClashState;
export const clientState = (client: ClientRoom): WitClashState =>
  client.state as unknown as WitClashState;

export interface Seated {
  n: number;
  client: ClientRoom;
  errors: Array<{ code: string }>;
}

export async function join(t: TestServer, room: Room, n: number): Promise<Seated> {
  const client = await t.join(room, { playerId: pid(n) });
  const errors = collectMessages(client, "ERROR") as Array<{ code: string }>;
  return { n, client, errors };
}

export const name = (who: Seated): void => who.client.send("SET_NAME", `P${who.n}`);

/** Joins and names one player. */
export async function seat(t: TestServer, room: Room, n: number): Promise<Seated> {
  const who = await join(t, room, n);
  name(who);
  return who;
}

/** Joins and names `count` players; the first (the host) then presses Start unless `start` is false. */
export async function seatAll(
  t: TestServer,
  room: Room,
  count: number,
  start = true,
): Promise<Seated[]> {
  const seated: Seated[] = [];
  for (let n = 1; n <= count; ++n) seated.push(await join(t, room, n));
  for (const who of seated) name(who);
  if (start) {
    await waitUntil(
      () => [...serverState(room).players.values()].filter((p) => p.isReady).length === count,
      "everyone named",
    );
    act(seated[0] as Seated, "START_GAME");
  }
  return seated;
}

export const act = (who: Seated, type: string, fields: Record<string, unknown> = {}): void =>
  who.client.send("ACTION", { type, ...fields });

export async function voteCategory(room: Room, players: Seated[]): Promise<void> {
  await waitUntil(() => serverState(room).phase === "CategorySelection", "category vote");
  const categoryId = serverState(room).categoryOptions[0]?.id;
  for (const p of players) act(p, "VOTE_CATEGORY", { categoryId });
  await waitUntil(() => serverState(room).phase === "Prompting", "prompting");
}

/** Reads each player's prompts from their own client, as a real UI would. */
export async function answerAll(room: Room, players: Seated[]): Promise<void> {
  for (const p of players) {
    await waitUntil(
      () => clientState(p.client).mine?.get(pid(p.n))?.prompts?.length === 2,
      `prompts of ${p.n}`,
    );
    for (const prompt of clientState(p.client).mine.get(pid(p.n))?.prompts ?? []) {
      act(p, "SUBMIT_ANSWER", { matchupId: prompt.matchupId, answer: `answer ${p.n}` });
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
        if (state.mine.get(pid(p.n))?.canVote) act(p, "CAST_VOTE", { answerId });
      await waitUntil(
        () => state.phase !== "MatchupVoting" || state.activeMatchupIndex !== index,
        "voted",
      );
    }
    await sleep(10);
  }
}
