import { WebSocketTransport } from "@colyseus/ws-transport";
import { RoomCodeSchema } from "@partygame/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGameServer,
  createResolveCodeThrottle,
  DEFAULT_MAX_PAYLOAD_BYTES,
  resolveRateLimits,
  warnRateLimit,
} from "../src/createGameServer.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import { bootTestServer, type TestServer, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, GAMES, startedRoom, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

describe("createGameServer", () => {
  it("defines one room type per game with default timings and a fresh code service", async () => {
    expect(createGameServer({ games: GAMES })).toBeDefined();
    t = await bootTestServer({ games: GAMES.map((game) => ({ ...game, roomName: "other" })) });
    const room = await t.createRoom("other");
    expect(RoomCodeSchema.safeParse(stateOf(room).roomCode).success).toBe(true);
  });

  it("accepts a transport, a shared code service and explicit timings", () => {
    const server = createGameServer({
      games: GAMES,
      roomCodeService: new RoomCodeService(),
      transport: new WebSocketTransport(),
      reconnectMs: 10,
      emptyRoomGraceMs: 20,
    });
    expect(server).toBeDefined();
  });

  it("boots the test helper with a shared code service", async () => {
    const roomCodeService = new RoomCodeService();
    t = await bootTestServer({ games: GAMES, roomCodeService });
    expect(t.roomCodeService).toBe(roomCodeService);
  });
});

/** Opens a raw WebSocket to `url`, sends one binary frame of `size` bytes, and resolves with the server's close code. */
const rawFrameCloseCode = (url: string, size: number): Promise<number> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(
      () => reject(new Error(`raw frame to ${url} did not close within 3s`)),
      3000,
    );
    socket.onopen = () => {
      socket.send(new Uint8Array(size));
    };
    socket.onclose = (event) => {
      clearTimeout(timer);
      resolve(event.code);
    };
  });

describe("websocket payload limit", () => {
  it("defaults to an explicit 4 KiB limit", () => {
    expect(DEFAULT_MAX_PAYLOAD_BYTES).toBe(4096);
  });

  it("closes an oversized frame with 1009 without harming the room", async () => {
    t = await bootBuzzer(); // default 4 KiB limit
    const { room, p1 } = await startedRoom(t);
    expect(stateOf(room).buzzCount).toBe(0);

    const code = await rawFrameCloseCode(`${t.endpoint}/buzzer`, 5_000);
    expect(code).toBe(1009);

    // the oversized frame never reached the room
    expect(stateOf(room).buzzCount).toBe(0);
    expect(stateOf(room).winner).toBe("");

    // the other player can still act
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).buzzCount === 1, "p1 could still buzz");
  });

  it("accepts a frame above the default when maxPayloadBytes is raised", async () => {
    t = await bootBuzzer({ maxPayloadBytes: 65_536 });
    const code = await rawFrameCloseCode(`${t.endpoint}/buzzer`, 10 * 1024);
    expect(code).not.toBe(1009); // under the raised limit, so it is not rejected as too big
  });
});

describe("rate limits", () => {
  it("resolves the documented defaults and keeps explicit overrides", () => {
    expect(resolveRateLimits()).toEqual({
      action: { rate: 10, burst: 20 },
      setName: { rate: 2, burst: 2 },
      resolveCode: { rate: 1, burst: 10 },
      mode: "enforce",
    });
    expect(resolveRateLimits({ action: { rate: 1, burst: 1 }, mode: "observe" })).toEqual({
      ...resolveRateLimits(),
      action: { rate: 1, burst: 1 },
      mode: "observe",
    });
  });

  it("reports an observed limit hit through console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      warnRateLimit("room-1:player-1:ACTION");
      expect(warn).toHaveBeenCalledWith("[rate-limit] room-1:player-1:ACTION is over its limit");
    } finally {
      warn.mockRestore();
    }
  });

  it("boots a server in observe mode", async () => {
    t = await bootBuzzer({ rateLimits: { mode: "observe" } });
    const room = await t.createRoom("buzzer");
    expect(room).toBeDefined();
  });

  it("builds the code API throttle from rateLimits", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const defaults = createResolveCodeThrottle();
      expect(defaults.bucket).toEqual({ rate: 1, burst: 10 });
      for (let i = 0; i < 10; ++i) {
        expect(defaults.limiter.take("1.2.3.4", defaults.bucket)).toBe(true);
      }
      expect(defaults.limiter.take("1.2.3.4", defaults.bucket)).toBe(false); // enforce by default

      const observed = createResolveCodeThrottle({
        resolveCode: { rate: 3, burst: 1 },
        mode: "observe",
      });
      expect(observed.bucket).toEqual({ rate: 3, burst: 1 });
      expect(observed.limiter.take("5.6.7.8", observed.bucket)).toBe(true);
      expect(observed.limiter.take("5.6.7.8", observed.bucket)).toBe(true); // observed, not refused
      expect(warn).toHaveBeenCalledWith("[rate-limit] 5.6.7.8 is over its limit");
    } finally {
      warn.mockRestore();
    }
  });
});
