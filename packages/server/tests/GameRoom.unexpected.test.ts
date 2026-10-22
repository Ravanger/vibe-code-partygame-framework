import { logger } from "@colyseus/core";
import { CLOSE_CODES } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import { bootTestServer, type TestServer } from "../src/testing/index.js";
import { BuzzerGame, BuzzerState } from "./fixtures/buzzer.js";
import { pid, stateOf } from "./support.js";

const SECRET = "secret-internal-detail";

class ThrowingCodes extends RoomCodeService {
  override generateAndRegister(): string {
    throw new Error(SECRET);
  }
}

class ThrowingState extends BuzzerState {
  constructor() {
    super();
    throw new Error(SECRET);
  }
}

afterEach(() => vi.restoreAllMocks());

const expectFixed = (error: unknown): void => {
  expect(error).toMatchObject({
    code: CLOSE_CODES.INTERNAL.code,
    message: CLOSE_CODES.INTERNAL.message,
  });
  expect(JSON.stringify(error)).not.toContain(SECRET);
  expect(String((error as Error).message)).not.toContain(SECRET);
};

describe("unexpected failures reach the client as one fixed message", () => {
  let t: TestServer;
  beforeAll(async () => {
    t = await bootTestServer({
      roomCodeService: new ThrowingCodes(),
      games: [
        { roomName: "nocode", definition: BuzzerGame, stateClass: BuzzerState },
        { roomName: "nostate", definition: BuzzerGame, stateClass: ThrowingState },
      ],
    });
  });
  afterAll(() => t.shutdown());

  it("a throwing room code service on create", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => {});
    await expect(t.createRoom("nocode")).rejects.toSatisfy((e) => {
      expectFixed(e);
      return true;
    });
    expect(error).toHaveBeenCalledOnce();
  });

  it("a throwing state constructor on create", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    await expect(t.createRoom("nostate")).rejects.toSatisfy((e) => {
      expectFixed(e);
      return true;
    });
  });
});

describe("an unexpected throw inside onJoin", () => {
  it("answers the fixed message and keeps serving", async () => {
    const server = await bootTestServer({
      games: [{ roomName: "buzzer", definition: BuzzerGame, stateClass: BuzzerState }],
    });
    try {
      vi.spyOn(logger, "error").mockImplementation(() => {});
      const room = await server.createRoom("buzzer");
      const players = stateOf(room).players;
      const get = players.get.bind(players);
      vi.spyOn(players, "get").mockImplementation((key) => {
        if (key === pid(1)) throw new Error(SECRET);
        return get(key);
      });
      await expect(server.join(room, { playerId: pid(1) })).rejects.toSatisfy((e) => {
        expectFixed(e);
        return true;
      });
    } finally {
      await server.shutdown();
    }
  });
});
