import { RoomCodeService } from "@partygame/server";
import { bootTestServer, type TestServer, waitUntil } from "@partygame/server/testing";
import { LOBBY_PHASE, NAME_MAX_LENGTH, resolveRoomCode } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { BotPlayer } from "../src/BotPlayer.js";
import { BotTable } from "../src/BotTable.js";
import { claimName } from "../src/claimName.js";
import { DemoTable } from "../src/DemoTable.js";
import { apiBaseOf, joinBots } from "../src/joinBots.js";
import type { BotKit } from "../src/types.js";
import { TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

class RecordingCodes extends RoomCodeService {
  readonly codes: string[] = [];

  override register(code: string, roomId: string): void {
    this.codes.push(code);
    super.register(code, roomId);
  }
}

const codes = new RecordingCodes();
let t: TestServer;
let apiPort: number;
const leavers: Array<{ leave(): Promise<unknown> }> = [];
const FAST = { thinkMs: [0, 5], reactMs: [0, 5] } as const;

const tapper: BotKit<TapState> = {
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: { play: (turn) => turn.once("tap", () => turn.later("react", () => turn.act("TAP"))) },
};

beforeAll(async () => {
  t = await bootTestServer({
    roomCodeService: codes,
    games: [{ roomName: TAP_ROOM, definition: TapGame, stateClass: TapState }],
  });
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.allSettled(leavers.splice(0).map((each) => each.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

async function humanRoom(name: string) {
  const playerId = `human-${name}-0001`;
  const room = await t.sdk.create<TapState>(TAP_ROOM, { playerId }, TapState);
  leavers.push({ leave: () => room.leave(true) });
  await claimName(room, playerId, name);
  return room;
}

const join = (
  code: string,
  count: number,
  extra: { nameFor?: (n: number) => string; playerIds?: string[]; timeoutMs?: number } = {},
): Promise<BotPlayer<TapState>[]> =>
  joinBots({ ...tapper, code, count, endpoint: t.endpoint, apiPort, bot: FAST, ...extra }).then(
    (bots) => {
      leavers.push(...bots);
      return bots;
    },
  );

const resolve = (code: string): Promise<string> =>
  resolveRoomCode(`http://127.0.0.1:${apiPort}`, code);

const watch = async (code: string) => {
  const room = await t.sdk.joinById<TapState>(
    await resolve(code),
    { playerId: crypto.randomUUID(), spectator: true },
    TapState,
  );
  leavers.push({ leave: () => room.leave(true) });
  return room;
};

const seatedNames = (room: { state: TapState }): string[] =>
  [...room.state.players.values()].map((seat) => seat.name);

describe("claimName", () => {
  it("throws the server's refusal", async () => {
    const room = await humanRoom("Ann");
    const other = await t.sdk.joinById<TapState>(
      room.roomId,
      { playerId: "other-0000001" },
      TapState,
    );
    leavers.push({ leave: () => other.leave(true) });
    await expect(claimName(other, "other-0000001", "Ann")).rejects.toThrow(/taken/i);
  });
});

describe("joinBots", () => {
  it("joins named bots that skip taken names", async () => {
    const room = await humanRoom("Bot 1");
    const bots = await join(room.state.roomCode, 2);
    expect(bots.map((bot) => bot.name)).toEqual(["Bot 2", "Bot 3"]);
  });

  it("uses the given names and playerIds", async () => {
    const room = await humanRoom("Ann");
    const bots = await join(room.state.roomCode, 1, {
      nameFor: (n) => `Robo ${n}`,
      playerIds: ["robo-00000001"],
    });
    expect(bots[0]?.name).toBe("Robo 1");
    expect(bots[0]?.playerId).toBe("robo-00000001");
  });

  it("fails on an unknown code", async () => {
    await expect(join("ZZZZ", 1)).rejects.toThrow();
  });

  it("leaves the bots it seated when a later bot cannot be named", async () => {
    const room = await humanRoom("Ann");
    const nameFor = (n: number) => (n === 1 ? "Robo" : "Ann");
    await expect(join(room.state.roomCode, 2, { nameFor })).rejects.toThrow(
      "nameFor keeps returning names that are already taken",
    );
    await waitUntil(() => room.state.players.size === 1, "bots gone");
  });

  it("leaves its seat when the server refuses the name", async () => {
    const room = await humanRoom("Ann");
    const nameFor = () => "x".repeat(NAME_MAX_LENGTH + 1);
    await expect(join(room.state.roomCode, 1, { nameFor })).rejects.toThrow();
    await waitUntil(() => room.state.players.size === 1, "bot gone");
  });
});

describe("apiBaseOf", () => {
  it("maps ws to http and wss to https", () => {
    expect(apiBaseOf("ws://example.com:2567", 3001)).toBe("http://example.com:3001");
    expect(apiBaseOf("wss://example.com", 3001)).toBe("https://example.com:3001");
  });
});

describe("BotTable", () => {
  it("seats bots once a human has a name", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort, bot: FAST });
    leavers.push(table);
    const code = await table.open();
    const humanId = "human-zed-0001";
    const room = await t.sdk.joinById<TapState>(
      await resolve(code),
      { playerId: humanId },
      TapState,
    );
    leavers.push({ leave: () => room.leave(true) });
    await claimName(room, humanId, "Zed");
    const bots = await table.seatBots({ count: 2 });
    expect(bots).toHaveLength(2);
    await waitUntil(() => room.state.spectatorCount === 0, "table left");
    expect(room.state.players.size).toBe(3);
  });

  it("seats bots with their default pacing", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    const code = await table.open();
    const room = await t.sdk.joinById<TapState>(
      await resolve(code),
      { playerId: "human-zed-0002" },
      TapState,
    );
    leavers.push({ leave: () => room.leave(true) });
    await claimName(room, "human-zed-0002", "Zed");
    expect(await table.seatBots({ count: 1 })).toHaveLength(1);
  });

  it("refuses to open twice", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    await table.open();
    await expect(table.open()).rejects.toThrow("The table is already open");
  });

  it("leaves without hanging once the room is gone", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    await table.open();
    const closed = expect(table.seatBots({ count: 1, timeoutMs: 5000 })).rejects.toThrow(
      "The room closed while waiting for",
    );
    await t.cleanup();
    await closed;
    await expect(table.leave()).resolves.toBeUndefined();
  }, 3000);

  it("bots leave after the server is gone", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort, bot: FAST });
    const code = await table.open();
    const room = await t.sdk.joinById<TapState>(
      await resolve(code),
      { playerId: "human-zed-0003" },
      TapState,
    );
    await claimName(room, "human-zed-0003", "Zed");
    await table.seatBots({ count: 1 });
    await t.cleanup();
    await expect(table.leave()).resolves.toBeUndefined();
  });

  it("refuses to seat before it is open", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    await expect(table.seatBots({ count: 1 })).rejects.toThrow("The table is not open");
  });

  it("gives up when nobody names themselves in time", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    await table.open();
    await expect(table.seatBots({ count: 1, timeoutMs: 50 })).rejects.toThrow(
      "Timed out waiting for a player to join",
    );
  });

  it("stops waiting when the room closes", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    await table.open();
    const failure = expect(table.seatBots({ count: 1, timeoutMs: 5000 })).rejects.toThrow(
      "The room closed while waiting for",
    );
    await t.cleanup();
    await failure;
  });
});

describe("table overrides", () => {
  const nameFor = (n: number) => `Robo ${n}`;

  it("BotTable seats bots with the given nameFor", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort, bot: FAST, nameFor });
    leavers.push(table);
    const code = await table.open();
    const room = await t.sdk.joinById<TapState>(
      await resolve(code),
      { playerId: "human-zed-0004" },
      TapState,
    );
    leavers.push({ leave: () => room.leave(true) });
    await claimName(room, "human-zed-0004", "Zed");
    const bots = await table.seatBots({ count: 2 });
    expect(bots.map((bot) => bot.name)).toEqual(["Robo 1", "Robo 2"]);
  });

  it("DemoTable seats bots with the given nameFor", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 2,
      bot: FAST,
      nameFor,
      timeoutMs: 5000,
      isFinished: () => true,
    });
    leavers.push(table);
    await table.open();
    const bots = await table.seatBots();
    expect(bots.map((bot) => bot.name)).toEqual(["Robo 1", "Robo 2"]);
  });

  it("BotTable and DemoTable forward timeoutMs to joinBots", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort, timeoutMs: 1 });
    leavers.push(table);
    const code = await table.open();
    const room = await t.sdk.joinById<TapState>(
      await resolve(code),
      { playerId: "human-zed-0005" },
      TapState,
    );
    leavers.push({ leave: () => room.leave(true) });
    await claimName(room, "human-zed-0005", "Zed");
    await expect(table.seatBots({ count: 1 })).rejects.toThrow();
  });

  it("DemoTable honours a caller's bot.host.expectedPlayers", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      bot: { ...FAST, host: { expectedPlayers: 99 } },
      isFinished: () => true,
    });
    leavers.push(table);
    const spectator = await watch(await table.open());
    await table.seatBots();
    await waitUntil(() => seatedNames(spectator).filter((n) => n !== "").length === 2, "seated");
    await waitUntil(() => spectator.state.canStart, "startable");
    await expect(
      waitUntil(() => spectator.state.phase !== LOBBY_PHASE, "started", 300),
    ).rejects.toThrow();
  });
});

describe("DemoTable", () => {
  it("plays a watch-only game to the end", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 2,
      bot: FAST,
      isFinished: (state) => state.done,
    });
    leavers.push(table);
    const code = await table.open();
    expect(code).toMatch(/^[A-Z]{4}$/);
    await table.seatBots();
    await table.finished(5000);
    await table.leave();
    await table.leave();
  });

  it("names the host and uses default pacing", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      hostName: "Boss",
      roomOptions: {},
      isFinished: (state) => state.done,
    });
    leavers.push(table);
    const spectator = await watch(await table.open());
    await waitUntil(() => seatedNames(spectator).includes("Boss"), "host named");
    expect(await table.seatBots()).toHaveLength(1);
    await table.leave();
  });

  it("refuses to open twice", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      isFinished: () => true,
    });
    leavers.push(table);
    await table.open();
    await expect(table.open()).rejects.toThrow("The table is already open");
  });

  it("leaves the host room when the host cannot be named", async () => {
    const before = codes.codes.length;
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      hostName: "x".repeat(NAME_MAX_LENGTH + 1),
      isFinished: () => true,
    });
    await expect(table.open()).rejects.toThrow();
    const spectator = await watch(codes.codes[before] ?? "");
    await waitUntil(
      () => ![...spectator.state.players.values()].some((seat) => seat.isConnected),
      "host gone",
    );
  });

  it("leave() takes the host out of the room", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      isFinished: () => true,
    });
    const spectator = await watch(await table.open());
    await waitUntil(
      () => [...spectator.state.players.values()].some((seat) => seat.isConnected),
      "host seated",
    );
    await table.leave();
    await waitUntil(
      () => ![...spectator.state.players.values()].some((seat) => seat.isConnected),
      "host gone",
    );
  });

  it("stops waiting for the end when the room closes", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      isFinished: () => false,
    });
    leavers.push(table);
    await table.open();
    const failure = expect(table.finished(5000)).rejects.toThrow(
      "The room closed while waiting for",
    );
    await t.cleanup();
    await failure;
  });

  it("refuses to seat or wait before it is open", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      isFinished: () => true,
    });
    await expect(table.seatBots()).rejects.toThrow("The table is not open");
    await expect(table.finished()).rejects.toThrow("The table is not open");
  });
});
