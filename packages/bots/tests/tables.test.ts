import { type SchemaType, t as schemaField } from "@colyseus/schema";
import { Client, type Room } from "@colyseus/sdk";
import { claimName, resolveRoomCode } from "@partygame/client-utils";
import { actionFactory, defineGame } from "@partygame/core";
import { RoomCodeService } from "@partygame/server";
import { bootTestServer, type TestServer, waitUntil } from "@partygame/server/testing";
import {
  ClientMessage,
  LOBBY_PHASE,
  NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
  RoomCodeSchema,
} from "@partygame/shared";
import { PlayerSchema } from "@partygame/shared/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { BotPlayer } from "../src/BotPlayer.js";
import { BotTable } from "../src/BotTable.js";
import { DemoTable } from "../src/DemoTable.js";
import { joinBots } from "../src/joinBots.js";
import type { BotKit } from "../src/types.js";
import { TAP_PUBLIC_FIELDS, TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

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

// A tap game whose state can be padded to ~4 MB after open(). A bot that joins once the pad has
// landed receives a sync that blocks the event loop well past waitFor's 20 ms poll floor, so a
// 1 ms join budget forwarded to joinBots expires in joinOne. The pad stays out of open()'s own
// sync: under CI load its multi-megabyte decode exhausted claimName's 5 s budget before
// seatBots began (#294).
const PaddedState = TapState.extend({ pad: schemaField.string().default("") }, "PaddedTapState");
type PaddedState = SchemaType<typeof PaddedState>;

const PAD_BYTES = 4_000_000;
const paddedAction = actionFactory<PaddedState, Record<string, never>, Record<string, never>>();

const PaddedGame = defineGame<PaddedState, Record<string, never>, Record<string, never>>({
  name: "TapPadded",
  version: "1",
  minPlayers: 1,
  maxPlayers: 6,
  startPhase: "Idle",
  // The room leaves the built-in Lobby as soon as its first player claims a name, so PAD (an
  // Idle-phase action) is reachable right after open()'s claimName; games cannot add lobby actions.
  autoStart: true,
  createPrivateState: () => ({}),
  phases: {
    Idle: {
      actions: {
        PAD: paddedAction({
          from: "player",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.state.pad = "x".repeat(PAD_BYTES);
          },
        }),
      },
    },
  },
});

const PAD_ROOM = "tap-padded";
const paddedKit: BotKit<PaddedState> = {
  roomName: PAD_ROOM,
  stateClass: PaddedState,
  strategy: { play: (turn) => turn.once("tap", () => turn.later("react", () => turn.act("TAP"))) },
};

/** A DemoTable that pads its own state after open(), so open() never decodes the ~4 MB payload. */
class PaddedDemoTable extends DemoTable<PaddedState> {
  async pad(): Promise<unknown> {
    if (!this.seat) throw new Error("the table is not open");
    return this.seat.room.request(ClientMessage.ACTION, { type: "PAD" });
  }
}

/** Simulates the wire-level decode hiccup that clobbers a synced field after open(). */
class ClobberingDemoTable extends PaddedDemoTable {
  clobberRoomCode(): void {
    if (!this.seat) throw new Error("the table is not open");
    this.seat.room.state.roomCode = "";
  }
}

beforeAll(async () => {
  t = await bootTestServer({
    roomCodeService: codes,
    games: [
      {
        roomName: TAP_ROOM,
        definition: TapGame,
        stateClass: TapState,
        publicFields: TAP_PUBLIC_FIELDS,
      },
      {
        roomName: PAD_ROOM,
        definition: PaddedGame,
        stateClass: PaddedState,
        publicFields: [...TAP_PUBLIC_FIELDS, "pad"],
      },
    ],
  });
  apiPort = await t.serveApi();
});
afterEach(async () => {
  await Promise.allSettled(leavers.splice(0).map((each) => each.leave()));
  await t.cleanup();
});
afterAll(() => t.shutdown());

async function humanRoom(name: string) {
  const playerId = `human-${name.replace(/\s+/g, "-")}-0001`;
  const room = await t.sdk.create<TapState>(
    TAP_ROOM,
    { playerId, seatSecret: t.seatSecretFor(playerId), protocolVersion: PROTOCOL_VERSION },
    TapState,
  );
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
    { playerId: crypto.randomUUID(), spectator: true, protocolVersion: PROTOCOL_VERSION },
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
      {
        playerId: "other-0000001",
        seatSecret: t.seatSecretFor("other-0000001"),
        protocolVersion: PROTOCOL_VERSION,
      },
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

  it("sends the current protocol version on join", async () => {
    const room = await humanRoom("Ann");
    const spy = vi.spyOn(Client.prototype, "joinById");
    try {
      await join(room.state.roomCode, 1);
      expect(spy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("sends a fresh seat secret on every bot join", async () => {
    const room = await humanRoom("Ann");
    const spy = vi.spyOn(Client.prototype, "joinById");
    try {
      const bots = await join(room.state.roomCode, 2);
      expect(spy.mock.calls.length).toBe(2);
      for (const call of spy.mock.calls) {
        expect(call[1]).toEqual(
          expect.objectContaining({ seatSecret: expect.stringMatching(/^[0-9a-f-]{72}$/) }),
        );
      }
      expect(bots.map((bot) => bot.playerId)).toEqual(
        spy.mock.calls.map((call) => call[1].playerId),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("times out when the initial state has not arrived", async () => {
    // The SDK resolves joinById before the first state sync; room.state is undefined until it lands.
    const room = await humanRoom("Ann");
    const fakeRoom = { state: undefined, leave: async () => 0 };
    const spy = vi.spyOn(Client.prototype, "joinById");
    try {
      spy.mockImplementation(async () => fakeRoom as never);
      await expect(join(room.state.roomCode, 1, { timeoutMs: 1 })).rejects.toThrow(
        "Timed out waiting for the room state",
      );
    } finally {
      spy.mockRestore();
    }
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
      {
        playerId: humanId,
        seatSecret: t.seatSecretFor(humanId),
        protocolVersion: PROTOCOL_VERSION,
      },
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
      {
        playerId: "human-zed-0002",
        seatSecret: t.seatSecretFor("human-zed-0002"),
        protocolVersion: PROTOCOL_VERSION,
      },
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

  it("stamps created rooms with the current protocol version", async () => {
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort, bot: FAST });
    leavers.push(table);
    const spy = vi.spyOn(Client.prototype, "create");
    try {
      await table.open();
      expect(spy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("open() refuses a synced code that is non-empty but malformed", async () => {
    // A decode hiccup can leave roomCode non-empty but invalid; open() must not capture it —
    // fail loudly with its own timeout instead of surfacing the API's "Invalid code format" later.
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    const realCreate = Client.prototype.create;
    const createSpy = vi.spyOn(Client.prototype, "create");
    try {
      createSpy.mockImplementation(async function (
        this: Client,
        ...args: [string, object?, unknown?]
      ) {
        const room = await (
          realCreate as (
            roomName: string,
            options?: object,
            rootSchema?: unknown,
          ) => Promise<Room<TapState>>
        ).call(this, ...args);
        // Leave the code non-empty but malformed in the first state application.
        room.onStateChange(() => {
          if (RoomCodeSchema.safeParse(room.state.roomCode).success) {
            room.state.roomCode = "ab";
          }
        });
        return room;
      } as never);
      await expect(table.open()).rejects.toThrow("Timed out waiting for the room code");
    } finally {
      createSpy.mockRestore();
    }
  }, 20_000);

  it("open() waits for the initial state sync before reading the code", async () => {
    // The SDK resolves create() before the first state sync; room.state is undefined until it lands.
    const table = new BotTable({ ...tapper, endpoint: t.endpoint, apiPort });
    leavers.push(table);
    const state = new TapState();
    let synced = false;
    setTimeout(() => {
      state.roomCode = "WXYZ";
      synced = true;
    }, 30);
    const fakeRoom = {
      get state() {
        return synced ? state : undefined;
      },
      onLeave: () => undefined,
      leave: async () => 0,
    };
    const spy = vi.spyOn(Client.prototype, "create");
    try {
      spy.mockImplementation(async () => fakeRoom as never);
      await expect(table.open()).resolves.toBe("WXYZ");
    } finally {
      spy.mockRestore();
    }
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
      {
        playerId: "human-zed-0003",
        seatSecret: t.seatSecretFor("human-zed-0003"),
        protocolVersion: PROTOCOL_VERSION,
      },
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
      {
        playerId: "human-zed-0004",
        seatSecret: t.seatSecretFor("human-zed-0004"),
        protocolVersion: PROTOCOL_VERSION,
      },
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
    // The pad is applied after open(): a bot that joins once it has landed receives the ~4 MB
    // sync that blocks the event loop well past waitFor's 20 ms poll floor, so a 1 ms budget
    // forwarded to joinBots expires in joinOne — in whichever of its two waits (the pending poll
    // and the synced state race); the 5000 ms default would resolve. open() itself must stay on
    // the small state: under CI load the multi-megabyte decode exhausted claimName's 5 s budget
    // before seatBots began (#294).
    const table = new BotTable({ ...paddedKit, endpoint: t.endpoint, apiPort, timeoutMs: 1 });
    leavers.push(table);
    const code = await table.open();
    const room = await t.sdk.joinById<PaddedState>(
      await resolve(code),
      {
        playerId: "human-zed-0005",
        seatSecret: t.seatSecretFor("human-zed-0005"),
        protocolVersion: PROTOCOL_VERSION,
      },
      PaddedState,
    );
    leavers.push({ leave: () => room.leave(true) });
    await claimName(room, "human-zed-0005", "Zed");
    expect(await room.request(ClientMessage.ACTION, { type: "PAD" })).toEqual({ ok: true });
    // Either of joinOne's two waits can carry the timeout (see above); both prove forwarding.
    await expect(table.seatBots({ count: 1 })).rejects.toThrow(
      /Timed out waiting for (the room state|your name to be accepted)/,
    );

    const demo = new PaddedDemoTable({
      ...paddedKit,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      timeoutMs: 1,
      isFinished: () => true,
    });
    leavers.push(demo);
    await demo.open();
    expect(await demo.pad()).toEqual({ ok: true });
    await expect(demo.seatBots()).rejects.toThrow(
      /Timed out waiting for (the room state|your name to be accepted)/,
    );
  }, 20_000);

  it("DemoTable keeps the code open() verified when synced state is later clobbered", async () => {
    // CI observed a wire-level decode hiccup on the ~4 MB padded state: after open() had read
    // the code, roomCode came back "" and seatBots died with the API's "Invalid code format".
    const demo = new ClobberingDemoTable({
      ...paddedKit,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      timeoutMs: 1,
      isFinished: () => true,
    });
    leavers.push(demo);
    await demo.open();
    expect(await demo.pad()).toEqual({ ok: true });
    demo.clobberRoomCode();
    // The 1 ms budget can expire in either of joinOne's two waits; both prove forwarding.
    await expect(demo.seatBots()).rejects.toThrow(
      /Timed out waiting for (the room state|your name to be accepted)/,
    );
  }, 20_000);

  it("DemoTable keeps a code observed before claimName when state is clobbered mid-open", async () => {
    // Second CI observation of the padded-state hiccup: the clobber landed while open() was still
    // inside claimName, so a read taken after it captured "". The capture must be atomic with its
    // first well-formed observation, before any round trip.
    const demo = new PaddedDemoTable({
      ...paddedKit,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      timeoutMs: 1,
      isFinished: () => true,
    });
    leavers.push(demo);
    const realCreate = Client.prototype.create;
    let clobbered = false;
    const createSpy = vi.spyOn(Client.prototype, "create");
    try {
      createSpy.mockImplementation(async function (
        this: Client,
        ...args: [string, object?, unknown?]
      ) {
        const room = await (
          realCreate as (
            roomName: string,
            options?: object,
            rootSchema?: unknown,
          ) => Promise<Room<PaddedState>>
        ).call(this, ...args);
        // Clobber the code in the same state application that accepts the host's name — inside
        // claimName's wait window, where a late read would capture "".
        room.onStateChange(() => {
          if (clobbered) return;
          const named = [...room.state.players.values()].some((seat) => seat.name !== "");
          if (named && RoomCodeSchema.safeParse(room.state.roomCode).success) {
            room.state.roomCode = "";
            clobbered = true;
          }
        });
        return room;
      } as never);
      const code = await demo.open();
      expect(RoomCodeSchema.safeParse(code).success).toBe(true);
      expect(await demo.pad()).toEqual({ ok: true });
      // The 1 ms budget can expire in either of joinOne's two waits; both prove forwarding.
      await expect(demo.seatBots()).rejects.toThrow(
        /Timed out waiting for (the room state|your name to be accepted)/,
      );
    } finally {
      createSpy.mockRestore();
    }
  }, 20_000);

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
    expect(RoomCodeSchema.safeParse(code).success).toBe(true);
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

  it("stamps created rooms with the current protocol version", async () => {
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 1,
      roomOptions: {},
      isFinished: (state) => state.done,
    });
    leavers.push(table);
    const spy = vi.spyOn(Client.prototype, "create");
    try {
      await table.open();
      expect(spy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("open() waits for the initial state sync before reading the code", async () => {
    // The SDK resolves create() before the first state sync; room.state is undefined until it lands.
    const table = new DemoTable({
      ...tapper,
      endpoint: t.endpoint,
      apiPort,
      bots: 0,
      isFinished: () => true,
    });
    leavers.push(table);
    const state = new TapState();
    let hostId = "";
    let synced = false;
    setTimeout(() => {
      state.roomCode = "ABCD";
      synced = true;
    }, 30);
    const fakeRoom = {
      get state() {
        return synced ? state : undefined;
      },
      onLeave: () => undefined,
      onStateChange: () => undefined,
      onMessage: () => () => undefined,
      send: (type: string, name?: unknown) => {
        if (type !== ClientMessage.SET_NAME || typeof name !== "string") return;
        setTimeout(() => {
          const seat = new PlayerSchema();
          seat.id = hostId;
          seat.name = name;
          state.players.set(hostId, seat);
        }, 10);
      },
      request: async () => ({ ok: true }),
      leave: async () => 0,
    };
    const spy = vi.spyOn(Client.prototype, "create");
    try {
      spy.mockImplementation(async function (this: Client, ...args: [string, object?, unknown?]) {
        hostId = (args[1] as { playerId?: string } | undefined)?.playerId ?? "";
        return fakeRoom;
      } as never);
      await expect(table.open()).resolves.toBe("ABCD");
    } finally {
      spy.mockRestore();
    }
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
