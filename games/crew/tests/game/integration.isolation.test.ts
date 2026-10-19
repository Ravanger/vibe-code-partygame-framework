import {
  bootTestServer,
  seatPlayers,
  stateOf,
  type TestServer,
  waitUntil,
} from "@partygame/server/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCrewGame } from "../../src/game.js";
import { META } from "../../src/meta.js";
import { CrewState } from "../../src/state.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootTestServer({
    games: [{ roomName: META.roomName, definition: createCrewGame(), stateClass: CrewState }],
  });
});
afterAll(async () => {
  await t.shutdown();
});

async function startedCrew(count: number) {
  const room = await t.createRoom(META.roomName);
  const players = await seatPlayers(t, room, { stateClass: CrewState, count, start: true });
  await waitUntil(() => stateOf(room, CrewState).phase === "Round", "first round");
  return { room, players };
}

describe("view isolation (room-level)", () => {
  it("shows each seat only its own private signal", async () => {
    const { players } = await startedCrew(3);
    for (const p of players) {
      await waitUntil(() => p.client.state.mine.size === 1, `mine of ${p.n}`);
      expect([...p.client.state.mine.keys()]).toEqual([p.playerId]);
      const signal = p.client.state.mine.get(p.playerId)?.signal;
      expect(signal).toBeGreaterThanOrEqual(1);
      expect(signal).toBeLessThanOrEqual(9);
    }
  });

  it("makes a shared signal public and keeps held signals private", async () => {
    const { room, players } = await startedCrew(3);
    const [p1, p2, p3] = players;
    if (!p1 || !p2 || !p3) throw new Error("expected three seated players");
    p1.act("SHARE");
    p2.act("HOLD");
    p3.act("HOLD");
    const state = stateOf(room, CrewState);
    await waitUntil(() => state.reveals.length === 1, "shared signal public");
    expect(state.reveals.map((r) => r.playerId)).toEqual([p1.playerId]);
    for (const p of players) {
      await waitUntil(() => p.client.state.reveals.length === 1, `client ${p.n} sees the share`);
      expect(p.client.state.mine.size).toBe(1);
      expect([...p.client.state.mine.keys()]).toEqual([p.playerId]);
    }
  });

  it("reveals a leaver's signal to the whole room", async () => {
    const { room, players } = await startedCrew(4);
    const [p1, p2, p3, p4] = players;
    if (!p1 || !p2 || !p3 || !p4) throw new Error("expected four seated players");
    p4.client.leave();
    const state = stateOf(room, CrewState);
    await waitUntil(() => state.reveals.length === 1, "leaver's signal public");
    expect(state.reveals.map((r) => r.playerId)).toEqual([p4.playerId]);
    for (const p of [p1, p2, p3]) {
      await waitUntil(() => p.client.state.reveals.length === 1, `client ${p.n} sees the reveal`);
      expect(p.client.state.mine.size).toBe(1);
      expect([...p.client.state.mine.keys()]).toEqual([p.playerId]);
    }
  });
});
