import type { Room } from "@colyseus/sdk";
import { type TestServer, waitUntil } from "@partygame/server/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PHASE } from "../../src/phaseNames.js";
import type { WitClashState } from "../../src/state.js";
import { DEMO_ROOM_OPTIONS, DemoTable, type DemoTableOptions } from "../../terminal/DemoTable.js";
import { GameClient } from "../../terminal/GameClient.js";
import { bootWitClash } from "../game/integrationSupport.js";

let t: TestServer;
let apiPort: number;
const tables: DemoTable[] = [];
const watchers: Array<Room<WitClashState>> = [];
const FAST = { answerDelayMs: [0, 20], voteDelayMs: [0, 20] } as const;

beforeAll(async () => {
  t = await bootWitClash();
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.all(watchers.splice(0).map((room) => room.leave()));
  await Promise.all(tables.splice(0).map((table) => table.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

const newTable = (over: Partial<DemoTableOptions> = {}): DemoTable => {
  const table = new DemoTable({
    endpoint: t.endpoint,
    apiPort,
    bots: 2,
    room: { totalRounds: 1, revealSeconds: 1 },
    bot: FAST,
    ...over,
  });
  tables.push(table);
  return table;
};

const watch = async (code: string): Promise<Room<WitClashState>> => {
  const room = await new GameClient(t.endpoint, apiPort).watch(code, crypto.randomUUID());
  watchers.push(room);
  return room;
};

describe("DemoTable", () => {
  it("plays one game by itself and stops on the final results", async () => {
    const table = newTable({ room: { totalRounds: 2, revealSeconds: 1 }, nextRoundDelayMs: 50 });
    const code = await table.open();
    const tv = await watch(code);
    const bots = await table.seatBots();

    expect(bots.map((bot) => bot.name)).toEqual(["Bot 1", "Bot 2"]);
    await table.finished(60_000);
    expect(tv.state.isFinalRound).toBe(true);
    expect(tv.state.roundNumber).toBe(2);
    expect([...tv.state.players.values()].map((seat) => seat.name).sort()).toEqual([
      "Bot 1",
      "Bot 2",
      "Host Bot",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(tv.state.phase).toBe(PHASE.Results);
  }, 90_000);

  it("is watch-only: spectators join, other players are refused", async () => {
    const table = newTable();
    const code = await table.open();
    const client = new GameClient(t.endpoint, apiPort);
    await watch(code);
    await expect(client.join(code, crypto.randomUUID(), "Intruder")).rejects.toThrow(
      "This room is watch-only",
    );
    await table.seatBots();
    await expect(client.join(code, crypto.randomUUID(), "Late")).rejects.toThrow(
      "This room is watch-only",
    );
  });

  it("applies the demo pacing unless overridden", async () => {
    const table = newTable({ room: { totalRounds: 1 } });
    const tv = await watch(await table.open());
    expect(JSON.parse(tv.state.options)).toEqual({ ...DEMO_ROOM_OPTIONS, totalRounds: 1 });
  });

  it("removes everyone on leave", async () => {
    const table = newTable({ bots: 1 });
    const tv = await watch(await table.open());
    await table.seatBots();
    await waitUntil(() => tv.state.players.size === 2, "both seated");
    await table.leave();
    await waitUntil(() => tv.state.players.size === 0, "everyone gone");
  });

  it("seats bots with their default pacing when none is given", async () => {
    const table = new DemoTable({ endpoint: t.endpoint, apiPort, bots: 1 });
    tables.push(table);
    await table.open();
    expect(await table.seatBots()).toHaveLength(1);
  });

  it("refuses to seat bots before the room is open", async () => {
    await expect(newTable().seatBots()).rejects.toThrow("not open");
    await expect(newTable().finished()).rejects.toThrow("not open");
  });
});
