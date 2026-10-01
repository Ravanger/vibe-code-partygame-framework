// @vitest-environment node
import { type TestServer, waitUntil } from "@partygame/server/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  act,
  answerAll,
  bootWitClash,
  clientState,
  join,
  pid,
  ROOM,
  seatAll,
  serverState,
  voteCategory,
} from "./integrationSupport.js";

const RECONNECT_MS = 500;
let t: TestServer;
beforeAll(async () => {
  t = await bootWitClash(RECONNECT_MS);
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("reconnection on a real server", () => {
  it("restores connection state and the private view when a dropped client returns with its token", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    const p2 = players[1] as (typeof players)[number];
    await waitUntil(
      () => clientState(p2.client).mine?.get(pid(2))?.prompts?.length === 2,
      "prompts",
    );
    const first = clientState(p2.client).mine.get(pid(2))?.prompts[0]?.matchupId;
    act(p2, "SUBMIT_ANSWER", { matchupId: first, answer: "before the drop" });
    await waitUntil(() => serverState(room).progress.get(pid(2)) === 1, "answer counted");

    const token = p2.client.reconnectionToken;
    await p2.client.leave(false);
    await waitUntil(
      () => serverState(room).players.get(pid(2))?.isConnected === false,
      "marked away",
    );

    const back = await t.sdk.reconnect(token);
    await waitUntil(
      () => serverState(room).players.get(pid(2))?.isConnected === true,
      "marked back",
    );
    await waitUntil(
      () => clientState(back).mine?.get(pid(2))?.prompts?.length === 2,
      "prompts restored",
    );
    const restored = clientState(back).mine.get(pid(2));
    expect(restored?.prompts[0]?.submitted).toBe(true);
    expect(restored?.prompts[1]?.submitted).toBe(false);
    expect(clientState(back).progress.get(pid(2))).toBe(1);
    expect([...clientState(back).mine.keys()]).toEqual([pid(2)]);
  });

  it("restores the private view when the player rejoins from a fresh session", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    const p3 = players[2] as (typeof players)[number];
    await waitUntil(
      () => clientState(p3.client).mine?.get(pid(3))?.prompts?.length === 2,
      "prompts",
    );
    await p3.client.leave(false);
    await waitUntil(() => serverState(room).players.get(pid(3))?.isConnected === false, "away");
    const fresh = await join(t, room, 3);
    await waitUntil(
      () => clientState(fresh.client).mine?.get(pid(3))?.prompts?.length === 2,
      "restored",
    );
    expect(serverState(room).players.size).toBe(4);
  });
});

describe("a player who leaves", () => {
  it("lets the category vote resolve when the last pending voter leaves", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await waitUntil(() => serverState(room).phase === "CategorySelection", "voting");
    const categoryId = serverState(room).categoryOptions[0]?.id;
    for (const p of players.slice(0, 3)) act(p, "VOTE_CATEGORY", { categoryId });
    await waitUntil(() => serverState(room).categoryOptions[0]?.votes === 3, "three votes");
    expect(serverState(room).phase).toBe("CategorySelection");
    await (players[3] as (typeof players)[number]).client.leave(true);
    await waitUntil(() => serverState(room).phase === "Prompting", "resolved without the leaver");
  });

  it("no longer stalls Prompting while a dropped player's seat is still held", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 4);
    await voteCategory(room, players);
    await (players[3] as (typeof players)[number]).client.leave(false);
    await waitUntil(() => serverState(room).players.get(pid(4))?.isConnected === false, "away");
    for (const p of players.slice(0, 3)) {
      await waitUntil(
        () => clientState(p.client).mine?.get(pid(p.n))?.prompts?.length === 2,
        "prompts",
      );
      for (const prompt of clientState(p.client).mine.get(pid(p.n))?.prompts ?? []) {
        act(p, "SUBMIT_ANSWER", { matchupId: prompt.matchupId, answer: "a" });
      }
    }
    await waitUntil(() => serverState(room).phase !== "Prompting", "prompting finished");
    expect(serverState(room).players.has(pid(4))).toBe(true);
  });
});

describe("answers across a whole table", () => {
  it("answers through each player's own client", async () => {
    const room = await t.createRoom(ROOM);
    const players = await seatAll(t, room, 3);
    await voteCategory(room, players);
    await answerAll(room, players);
    expect(serverState(room).votesExpected).toBe(1);
  });
});
