import { logger, matchMaker, type Room } from "@colyseus/core";
import { defineGame } from "@partygame/core";
import { CLOSE_CODES, MAX_OPTIONS_JSON_LENGTH, PROTOCOL_VERSION } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { bootTestServer, type TestServer } from "../src/testing/index.js";
import { BuzzerGame, BuzzerState, PlainGame } from "./fixtures/buzzer.js";

const LargeOptionsSchema = z.object({ data: z.string().optional() });
const LargeOptionsGame = defineGame<
  BaseGameState,
  Record<string, never>,
  z.infer<typeof LargeOptionsSchema>
>({
  name: "LargeOptions",
  version: "1",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  options: LargeOptionsSchema,
  createPrivateState: () => ({}),
  phases: { Play: {} },
});

let t: TestServer;
beforeAll(async () => {
  t = await bootTestServer({
    games: [
      { roomName: "plain", definition: PlainGame, stateClass: BaseGameState },
      { roomName: "buzzer", definition: BuzzerGame, stateClass: BuzzerState },
      { roomName: "large", definition: LargeOptionsGame, stateClass: BaseGameState },
    ],
  });
});
afterAll(() => t.shutdown());

describe("GameRoom with invalid create options", () => {
  it("fails to create with the INVALID_OPTIONS close code and no Zod text, and never registers a room code", async () => {
    const register = vi.spyOn(t.roomCodeService, "generateAndRegister");
    const unregister = vi.spyOn(t.roomCodeService, "unregister");
    await expect(t.createRoom("buzzer", { buzzMs: "x" })).rejects.toMatchObject({
      code: CLOSE_CODES.INVALID_OPTIONS.code,
      message: CLOSE_CODES.INVALID_OPTIONS.message,
    });
    expect(register).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    register.mockRestore();
    unregister.mockRestore();
  });

  it("logs the invalid-option detail server-side only", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    await expect(t.createRoom("buzzer", { buzzMs: "x" })).rejects.toMatchObject({
      message: CLOSE_CODES.INVALID_OPTIONS.message,
    });
    await expect(t.createRoom("buzzer", { seats: ["short"] })).rejects.toMatchObject({
      message: CLOSE_CODES.INVALID_OPTIONS.message,
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls[0])).toContain("buzzMs");
    warn.mockRestore();
  });

  it("rejects options JSON exceeding MAX_OPTIONS_JSON_LENGTH on create", async () => {
    const longValue = "x".repeat(MAX_OPTIONS_JSON_LENGTH);
    const register = vi.spyOn(t.roomCodeService, "generateAndRegister");
    await expect(t.createRoom("large", { data: longValue })).rejects.toMatchObject({
      code: CLOSE_CODES.INVALID_OPTIONS.code,
      message: CLOSE_CODES.INVALID_OPTIONS.message,
    });
    expect(register).not.toHaveBeenCalled();
    register.mockRestore();
  });
});

describe("GameRoom without an options schema", () => {
  it("rejects room creation with extra non-framework keys", async () => {
    await expect(
      t.createRoom("plain", {
        playerId: "x",
        name: "y",
        spectator: true,
        theme: "dark",
      }),
    ).rejects.toMatchObject({
      code: CLOSE_CODES.INVALID_OPTIONS.code,
      message: CLOSE_CODES.INVALID_OPTIONS.message,
    });
  });

  it("succeeds creating a room with no extra options", async () => {
    const room = await t.createRoom("plain", {
      playerId: "x",
      name: "y",
      spectator: true,
    });
    expect((room.state as BaseGameState).options).toBe("{}");
  });

  it("succeeds creating a room with only the protocol version", async () => {
    const listing = await matchMaker.createRoom("plain", { protocolVersion: PROTOCOL_VERSION });
    const room = matchMaker.getLocalRoomById(listing.roomId) as Room;
    expect((room.state as BaseGameState).options).toBe("{}");
  });
});
