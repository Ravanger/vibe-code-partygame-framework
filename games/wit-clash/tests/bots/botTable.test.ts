import type { Room } from "@colyseus/sdk";
import { type TestServer, waitUntil } from "@partygame/server/testing";
import { ClientMessage, ResolveCodeResponseSchema, START_GAME } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BotTable } from "../../bots/botTable.js";
import { WitClashState } from "../../src/state.js";
import { bootWitClash } from "../game/integrationSupport.js";

let t: TestServer;
let apiPort: number;
const tables: BotTable[] = [];
const FAST = { answerDelayMs: [0, 20], voteDelayMs: [0, 20] } as const;

beforeAll(async () => {
  t = await bootWitClash();
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.all(tables.splice(0).map((table) => table.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

const newTable = (fast = true): BotTable => {
  const table = new BotTable({ endpoint: t.endpoint, apiPort, ...(fast ? { bot: FAST } : {}) });
  tables.push(table);
  return table;
};

const joinAsHuman = async (roomCode: string, named: boolean): Promise<Room<WitClashState>> => {
  const response = await fetch(`http://localhost:${apiPort}/api/resolve-code?code=${roomCode}`);
  const body = ResolveCodeResponseSchema.parse(await response.json());
  if (!("roomId" in body)) throw new Error(body.error);
  const room = await t.sdk.joinById<WitClashState>(
    body.roomId,
    { playerId: "human-0001" },
    WitClashState,
  );
  await waitUntil(() => room.state.roomCode !== "", "room state");
  if (named) room.send(ClientMessage.SET_NAME, "Human");
  return room;
};

describe("BotTable", () => {
  it("seats bots after the human names themselves; the human hosts and can start", async () => {
    const table = newTable();
    const code = await table.open();
    expect(code).toMatch(/^[A-Z]{4}$/);

    const human = await joinAsHuman(code, true);
    const bots = await table.seatBots({ count: 3 });

    expect(bots.map((bot) => bot.name)).toEqual(["Bot 1", "Bot 2", "Bot 3"]);
    await waitUntil(() => human.state.spectatorCount === 0, "table left");
    expect(human.state.players.size).toBe(4);
    expect(human.state.players.get("human-0001")?.role).toBe("host");
    await waitUntil(() => human.state.canStart, "canStart");
    expect(await human.request(ClientMessage.ACTION, { type: START_GAME })).toEqual({ ok: true });
  });

  it("does not seat bots before the human is named", async () => {
    const table = newTable(false);
    const code = await table.open();
    const human = await joinAsHuman(code, false);

    let seated = false;
    const pending = table.seatBots({ count: 2 }).then((bots) => {
      seated = true;
      return bots;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(seated).toBe(false);
    expect(human.state.players.size).toBe(1);

    human.send(ClientMessage.SET_NAME, "Human");
    expect(await pending).toHaveLength(2);
  });

  it("times out when nobody joins", async () => {
    const table = newTable();
    await table.open();
    await expect(table.seatBots({ count: 1, timeoutMs: 50 })).rejects.toThrow(
      "Timed out waiting for a player to join",
    );
  });

  it("rejects when the room closes while waiting", async () => {
    const table = newTable();
    await table.open();
    const pending = table.seatBots({ count: 1 });
    const failure = expect(pending).rejects.toThrow("The room closed");
    await t.cleanup();
    await failure;
  });

  it("rejects seatBots before open", async () => {
    await expect(newTable().seatBots({ count: 1 })).rejects.toThrow("not open");
  });

  it("leave() removes the bots", async () => {
    const table = newTable();
    const code = await table.open();
    const human = await joinAsHuman(code, true);
    await table.seatBots({ count: 1 });
    await waitUntil(() => human.state.players.size === 2, "bot seated");
    await table.leave();
    await waitUntil(() => human.state.players.size === 1, "bot gone");
  });
});
