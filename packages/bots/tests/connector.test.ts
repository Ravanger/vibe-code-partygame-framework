import type {
  ConnectedRoom,
  RoomConnector,
  RoomCreateOptions,
  RoomJoinOptions,
} from "@partygame/client-utils";
import { ClientMessage } from "@partygame/shared";
import { PlayerSchema } from "@partygame/shared/schema";
import { describe, expect, it, vi } from "vitest";
import { BotTable } from "../src/BotTable.js";
import { ColyseusConnector } from "../src/ColyseusConnector.js";
import { DemoTable } from "../src/DemoTable.js";
import { joinBots } from "../src/joinBots.js";
import type { BotKit } from "../src/types.js";
import { TAP_ROOM, TapState } from "./fixtures/tapGame.js";

const kit: BotKit<TapState> = {
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: { play: () => undefined },
};

const FAST = { thinkMs: [0, 5], reactMs: [0, 5] } as const;

/** A hand-written room: a well-formed code, empty seats for its players, SET_NAME applied to the claiming seat. */
class FakeRoom implements ConnectedRoom<TapState> {
  readonly state: TapState;
  readonly sent: Array<{ type: string; payload?: unknown }> = [];
  /** The player whose SET_NAME is next; the connector sets it when a seat opens. */
  pendingClaim: string | undefined;

  constructor(code: string) {
    this.state = new TapState();
    this.state.roomCode = code;
  }

  seat(playerId: string): void {
    const seat = new PlayerSchema();
    seat.id = playerId;
    this.state.players.set(playerId, seat);
    this.pendingClaim = playerId;
  }

  onStateChange(): unknown {
    return { remove: () => undefined };
  }

  onLeave(): unknown {
    return { remove: () => undefined };
  }

  onMessage(): () => void {
    return () => undefined;
  }

  send(type: string, payload?: unknown): void {
    this.sent.push({ type, payload });
    if (type !== ClientMessage.SET_NAME || typeof payload !== "string") return;
    const seat =
      this.state.players.get(this.pendingClaim ?? "") ??
      [...this.state.players.values()].find((each) => each.name === "");
    if (seat) seat.name = payload;
    this.pendingClaim = undefined;
  }

  request(): Promise<unknown> {
    return Promise.resolve({ ok: true });
  }

  leave(): Promise<unknown> {
    return Promise.resolve(0);
  }
}

/** The fake world's resolver: the code is already the id. */
const IDENTITY = async (code: string) => code;

/** A hand-written connector: records every call; joins of one id land in the same room, as on a real server. */
class FakeConnector implements RoomConnector<TapState> {
  readonly created: RoomCreateOptions[] = [];
  readonly joined: Array<{ roomId: string; options: RoomJoinOptions }> = [];
  readonly rooms: FakeRoom[] = [];
  private readonly byId = new Map<string, FakeRoom>();

  async create(options: RoomCreateOptions): Promise<ConnectedRoom<TapState>> {
    this.created.push(options);
    const room = new FakeRoom("WXYZ");
    room.seat(options.playerId);
    this.rooms.push(room);
    this.byId.set(room.state.roomCode, room);
    return room;
  }

  async join(roomId: string, options: RoomJoinOptions): Promise<ConnectedRoom<TapState>> {
    this.joined.push({ roomId, options });
    let room = this.byId.get(roomId);
    if (room === undefined) {
      room = new FakeRoom(roomId);
      this.rooms.push(room);
      this.byId.set(roomId, room);
    }
    room.seat(options.playerId);
    if (options.name !== undefined) {
      const seat = room.state.players.get(options.playerId);
      if (seat) seat.name = options.name;
    }
    return room;
  }
}

describe("the RoomConnector seam", () => {
  it("joinBots joins through the injected connector and claims free names", async () => {
    const fake = new FakeConnector();
    const bots = await joinBots({
      ...kit,
      code: "WXYZ",
      count: 2,
      endpoint: "ws://unused",
      apiPort: 0,
      bot: FAST,
      connector: fake,
      resolveCode: IDENTITY,
    });
    expect(fake.joined.map((each) => each.roomId)).toEqual(["WXYZ", "WXYZ"]);
    expect(bots.map((bot) => bot.name)).toEqual(["Bot 1", "Bot 2"]);
    expect(fake.rooms[0]?.sent).toContainEqual({ type: ClientMessage.SET_NAME, payload: "Bot 1" });
  });

  it("resolves the room code once per batch and joins every bot by the resolved id", async () => {
    const fake = new FakeConnector();
    const resolveCode = vi.fn(async (code: string) => code);
    const bots = await joinBots({
      ...kit,
      code: "WXYZ",
      count: 3,
      endpoint: "ws://unused",
      apiPort: 0,
      bot: FAST,
      connector: fake,
      resolveCode,
    });
    expect(resolveCode).toHaveBeenCalledTimes(1);
    expect(resolveCode).toHaveBeenCalledWith("WXYZ");
    expect(fake.joined.map((each) => each.roomId)).toEqual(["WXYZ", "WXYZ", "WXYZ"]);
    expect(bots).toHaveLength(3);
  });

  it("BotTable opens through the injected connector as a spectator and reuses it for its bots", async () => {
    const fake = new FakeConnector();
    const table = new BotTable({
      ...kit,
      endpoint: "ws://unused",
      apiPort: 0,
      bot: FAST,
      connector: fake,
      resolveCode: IDENTITY,
    });
    const code = await table.open();
    expect(code).toBe("WXYZ");
    expect(fake.created).toHaveLength(1);
    expect(fake.created[0]).toEqual(
      expect.objectContaining({ spectator: true, playerId: expect.any(String) }),
    );
    const room = fake.rooms[0];
    if (!room) throw new Error("the table did not open a room");
    const human = new PlayerSchema();
    human.id = "human-1";
    human.name = "Zed";
    room.state.players.set("human-1", human);
    const bots = await table.seatBots({ count: 1 });
    expect(bots.map((bot) => bot.name)).toEqual(["Bot 1"]);
    expect(fake.joined.map((each) => each.roomId)).toEqual(["WXYZ"]);
    await table.leave();
  });

  it("DemoTable creates through the injected connector, claims the host name and seats bots on the same connector", async () => {
    const fake = new FakeConnector();
    const demo = new DemoTable({
      ...kit,
      endpoint: "ws://unused",
      apiPort: 0,
      bots: 1,
      isFinished: () => true,
      connector: fake,
      resolveCode: IDENTITY,
    });
    const code = await demo.open();
    expect(code).toBe("WXYZ");
    expect(fake.created[0]).toEqual(
      expect.objectContaining({
        playerId: expect.any(String),
        seatSecret: expect.any(String),
        seats: expect.arrayContaining([expect.any(String)]),
      }),
    );
    const hostRoom = fake.rooms[0];
    if (!hostRoom) throw new Error("the demo did not open a room");
    expect(hostRoom.sent).toContainEqual({ type: ClientMessage.SET_NAME, payload: "Host Bot" });
    const bots = await demo.seatBots();
    expect(bots.map((bot) => bot.name)).toEqual(["Bot 1"]);
    expect(fake.joined.map((each) => each.roomId)).toEqual(["WXYZ"]);
    await demo.leave();
  });

  it("ColyseusConnector refuses to create rooms without a roomName", async () => {
    const connector = new ColyseusConnector("ws://localhost:1", { stateClass: TapState });
    await expect(connector.create({ playerId: "p" })).rejects.toThrow("roomName");
  });
});
