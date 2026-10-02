// @vitest-environment node
import { type TestServer, waitUntil } from "@partygame/server/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  answerAll,
  bootWitClash,
  pid,
  playVoting,
  ROOM,
  seat,
  seatAll,
  serverState,
  voteCategory,
} from "./integrationSupport.js";
import { nth } from "./support.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootWitClash();
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("a four-player round on a real server", () => {
  it("plays Lobby to Results and shows every client the same scoreboard", async () => {
    const room = await t.createRoom(ROOM, { totalRounds: 1, revealSeconds: 1 });
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    await answerAll(room, players);
    await playVoting(room, players);
    const state = serverState(room);
    expect(state.isFinalRound).toBe(true);
    expect(state.scoreboard).toHaveLength(4);
    await waitUntil(
      () => nth(players, 3).client.state.scoreboard?.length === 4,
      "scoreboard synced",
    );
    const seen = [...nth(players, 3).client.state.scoreboard].map((e) => [e.playerId, e.score]);
    expect(seen).toEqual([...state.scoreboard].map((e) => [e.playerId, e.score]));
    expect(players.every((p) => p.errors.length === 0)).toBe(true);
  }, 30_000);

  it("shows each player only their own private entry", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    for (const p of players) {
      await waitUntil(
        () => p.client.state.mine?.get(pid(p.n))?.prompts?.length === 2,
        `prompts of ${p.n}`,
      );
      expect([...p.client.state.mine.keys()]).toEqual([pid(p.n)]);
    }
    expect(serverState(room).mine.size).toBe(4);
  });

  it("keeps votes hidden until the reveal while the count is public", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    await answerAll(room, players);
    const state = serverState(room);
    const voter = players.find(
      (p) => state.mine.get(pid(p.n))?.canVote,
    ) as (typeof players)[number];
    const watcher = players.find((p) => p !== voter) as (typeof players)[number];
    const answerId = state.matchups[0]?.answers[0]?.id;
    voter.act("CAST_VOTE", { answerId });
    await waitUntil(() => watcher.client.state.votesCast === 1, "count visible to others");
    const seen = watcher.client.state;
    expect(seen.matchups[0]?.answers.every((a) => a.votes === 0 && a.authorId === "")).toBe(true);
    expect([...seen.mine.keys()]).toEqual([pid(watcher.n)]);
    expect(seen.mine.get(pid(watcher.n))?.matchupVote).toBe("");
    await waitUntil(
      () => voter.client.state.mine?.get(pid(voter.n))?.matchupVote === answerId,
      "own vote echoed",
    );
  });

  it("makes a mid-game joiner wait for the next round", async () => {
    const room = await t.createRoom(ROOM, { revealSeconds: 1 });
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    const late = await seat(t, room, 5);
    await waitUntil(() => serverState(room).players.has(pid(5)), "late seat");
    expect(serverState(room).players.get(pid(5))?.isActive).toBe(false);
    await answerAll(room, players);
    expect(serverState(room).votesExpected).toBe(2);
    expect(serverState(room).mine.has(pid(5))).toBe(false);
    late.act("CAST_VOTE", { answerId: serverState(room).matchups[0]?.answers[0]?.id });
    await waitUntil(() => late.errors.length === 1, "rejected");
    expect(late.errors[0]?.code).toBe("NOT_ACTIVE");
    await playVoting(room, players);
    nth(players, 0).act("NEXT_ROUND");
    await waitUntil(() => serverState(room).phase === "CategorySelection", "round two");
    expect(serverState(room).players.get(pid(5))?.isActive).toBe(true);
    await waitUntil(() => late.client.state.mine?.has(pid(5)), "late player's own entry");
  }, 30_000);

  it("refuses START_GAME below the minimum player count", async () => {
    const room = await t.createRoom(ROOM);
    const host = nth(await seatAll(t, room, 2, false), 0);
    host.act("START_GAME");
    await waitUntil(() => host.errors.length === 1, "error");
    expect(host.errors[0]?.code).toBe("NOT_ENOUGH_PLAYERS");
    expect(serverState(room).phase).toBe("Lobby");
  });
});
