import { createServer } from "node:http";
import type { Room } from "@colyseus/sdk";
import { type TestServer, waitUntil } from "@partygame/server/testing";
import { ClientMessage, START_GAME } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BotPlayer } from "../../bots/BotPlayer.js";
import { joinBots } from "../../bots/joinBots.js";
import { PHASE } from "../../src/phaseNames.js";
import { WitClashState } from "../../src/state.js";
import { bootWitClash, ROOM } from "../game/integrationSupport.js";

let t: TestServer;
let apiPort: number;
const bots: BotPlayer[] = [];
const FAST = { answerDelayMs: [0, 20], voteDelayMs: [0, 20] } as const;

beforeAll(async () => {
  t = await bootWitClash();
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.all(bots.splice(0).map((bot) => bot.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

const createRoom = async (name: string): Promise<Room<WitClashState>> => {
  const room = await t.sdk.create<WitClashState>(
    ROOM,
    { playerId: `host-${name}-0001`, totalRounds: 1, revealSeconds: 1 },
    WitClashState,
  );
  await waitUntil(() => room.state.roomCode !== "", "room code");
  room.send(ClientMessage.SET_NAME, name);
  return room;
};

const join = (room: Room<WitClashState>, count: number, log?: (line: string) => void) =>
  joinBots({
    code: room.state.roomCode,
    count,
    endpoint: t.endpoint,
    apiPort,
    bot: { ...FAST, ...(log ? { log } : {}) },
  });

describe("joinBots", () => {
  it("seats named bots that play a whole game with a human host", async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const host = await createRoom("Host");
    bots.push(...(await join(host, 3, log)));
    bots.push(new BotPlayer(host, "host-Host-0001", "Host", { ...FAST, log }));
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

  it("skips names already in the room", async () => {
    const host = await createRoom("bot 1");
    bots.push(...(await join(host, 2)));
    expect(bots.map((bot) => bot.name)).toEqual(["Bot 2", "Bot 3"]);
  });

  it("uses the given playerIds first, then random ones", async () => {
    const host = await createRoom("Host");
    bots.push(
      ...(await joinBots({
        code: host.state.roomCode,
        count: 2,
        endpoint: t.endpoint,
        apiPort,
        playerIds: ["given-player-0001"],
      })),
    );
    expect(bots[0]?.playerId).toBe("given-player-0001");
    expect(bots[1]?.playerId).not.toBe("given-player-0001");
    expect(host.state.players.has("given-player-0001")).toBe(true);
  });

  it("leave() removes the bot from the room", async () => {
    const host = await createRoom("Host");
    const [bot] = await join(host, 1);
    await waitUntil(() => host.state.players.size === 2, "bot seated");
    await bot?.leave();
    await waitUntil(() => host.state.players.size === 1, "bot gone");
  });

  it("rejects an unknown room code", async () => {
    await expect(
      joinBots({ code: "ZZZZ", count: 1, endpoint: t.endpoint, apiPort }),
    ).rejects.toThrow("Game code not found");
  });

  it("rejects a reply it cannot read", async () => {
    const odd = createServer((_req, res) => res.end("{}"));
    await new Promise<void>((resolve) => odd.listen(0, "127.0.0.1", resolve));
    const address = odd.address();
    const port = typeof address === "object" && address ? address.port : 0;
    await expect(
      joinBots({ code: "ABCD", count: 1, endpoint: t.endpoint, apiPort: port }),
    ).rejects.toThrow("Unexpected reply");
    await new Promise((resolve) => odd.close(resolve));
  });

  it("gives up when the room does not confirm the name in time", async () => {
    const host = await createRoom("Host");
    await expect(
      joinBots({
        code: host.state.roomCode,
        count: 1,
        endpoint: t.endpoint,
        apiPort,
        timeoutMs: -1,
      }),
    ).rejects.toThrow("Timed out");
  });
});
