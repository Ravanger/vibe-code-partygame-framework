import type { Room } from "@colyseus/sdk";
import { BotPlayer, BotTable, joinBots } from "@partygame/bots";
import { type TestServer, waitUntil } from "@partygame/server/testing";
import {
  ClientMessage,
  ResolveCodeResponseSchema,
  SET_OPTIONS,
  START_GAME,
} from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { witClashBot, witClashKit } from "../../bots/witClashBot.js";
import { PHASE } from "../../src/phaseNames.js";
import { WitClashState } from "../../src/state.js";
import { bootWitClash, ROOM } from "../game/integrationSupport.js";

let t: TestServer;
let apiPort: number;
const bots: Array<BotPlayer<WitClashState>> = [];
const tables: Array<BotTable<WitClashState>> = [];
const FAST = { thinkMs: [0, 20], reactMs: [0, 20] } as const;

beforeAll(async () => {
  t = await bootWitClash();
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.all(bots.splice(0).map((bot) => bot.leave()));
  await Promise.all(tables.splice(0).map((table) => table.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

describe("WitClash bots on a real server", () => {
  it("joinBots seats named bots that play a whole game with a human host", async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const host = await t.sdk.create<WitClashState>(
      ROOM,
      { playerId: "host-Host-0001", totalRounds: 1, revealSeconds: 1 },
      WitClashState,
    );
    await waitUntil(() => host.state.roomCode !== "", "room code");
    host.send(ClientMessage.SET_NAME, "Host");
    bots.push(
      ...(await joinBots({
        ...witClashKit(),
        code: host.state.roomCode,
        count: 3,
        endpoint: t.endpoint,
        apiPort,
        bot: { ...FAST, log },
      })),
    );
    bots.push(new BotPlayer(host, "host-Host-0001", "Host", witClashBot(), { ...FAST, log }));
    expect(bots.slice(0, 3).map((bot) => bot.name)).toEqual(["Bot 1", "Bot 2", "Bot 3"]);

    await waitUntil(() => host.state.canStart, "canStart");
    expect(await host.request(ClientMessage.ACTION, { type: START_GAME })).toEqual({ ok: true });
    await waitUntil(() => host.state.phase === PHASE.Results, "results", 20_000);

    for (const bot of bots) {
      const mine = (verb: string) => lines.filter((line) => line.startsWith(`${bot.name} ${verb}`));
      expect(mine("answers")).toHaveLength(2);
      expect(mine("votes for").length).toBeGreaterThanOrEqual(2);
      expect(mine("answers").every((line) => line.includes('"ok":true'))).toBe(true);
    }
    expect(host.state.scoreboard).toHaveLength(4);
  }, 30_000);

  it("BotTable seats bots once the human is named, and play with the human, who starts the game", async () => {
    const table = new BotTable({ ...witClashKit(), endpoint: t.endpoint, apiPort, bot: FAST });
    tables.push(table);
    const code = await table.open();
    const response = await fetch(`http://localhost:${apiPort}/api/resolve-code?code=${code}`);
    const body = ResolveCodeResponseSchema.parse(await response.json());
    if (!("roomId" in body)) throw new Error(body.error);
    const human: Room<WitClashState> = await t.sdk.joinById<WitClashState>(
      body.roomId,
      { playerId: "human-0001" },
      WitClashState,
    );
    await waitUntil(() => human.state.roomCode !== "", "room state");
    human.send(ClientMessage.SET_NAME, "Human");

    const seated = await table.seatBots({ count: 3 });
    expect(seated.map((bot) => bot.name)).toEqual(["Bot 1", "Bot 2", "Bot 3"]);
    bots.push(new BotPlayer(human, "human-0001", "Human", witClashBot(), FAST));
    await waitUntil(() => human.state.canStart, "canStart");
    expect(
      await human.request(ClientMessage.ACTION, {
        type: SET_OPTIONS,
        totalRounds: 1,
        revealSeconds: 1,
      }),
    ).toEqual({ ok: true });
    expect(await human.request(ClientMessage.ACTION, { type: START_GAME })).toEqual({ ok: true });
    await waitUntil(() => human.state.phase === PHASE.Results, "results", 30_000);
    expect(human.state.scoreboard).toHaveLength(4);
  }, 40_000);
});
