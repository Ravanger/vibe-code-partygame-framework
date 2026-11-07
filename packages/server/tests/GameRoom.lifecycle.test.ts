import { matchMaker } from "@colyseus/core";
import { createTextFilter } from "@partygame/content/filter";
import { defineGame } from "@partygame/core";
import { CLOSE_CODES, PROTOCOL_VERSION } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import type { TestServer } from "../src/testing/index.js";
import { bootTestServer, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, lockedStateOf, pid, sleep, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

const alive = (roomId: string) => matchMaker.getLocalRoomById(roomId) !== undefined;

/** A single-phase game that filters names at moderate, for the refused-join disposal tests. */
const FilteredGame = defineGame<BaseGameState, Record<string, never>, Record<string, never>>({
  name: "Filtered",
  version: "1",
  minPlayers: 1,
  maxPlayers: 2,
  startPhase: "Play",
  filterLevel: () => "moderate",
  createPrivateState: () => ({}),
  phases: { Play: {} },
});

describe("GameRoom disposal", () => {
  it("disposes a room nobody ever joined and frees its code", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 100 });
    const room = await t.createRoom("buzzer");
    const code = stateOf(room).roomCode;
    expect(t.roomCodeService.resolve(code)).toBe(room.roomId);
    await waitUntil(() => !alive(room.roomId), "disposed");
    expect(t.roomCodeService.resolve(code)).toBeUndefined();
  });

  it("disposes after the last player leaves, but not once someone joins back", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 300 });
    const room = await t.createRoom("buzzer");
    const first = await t.join(room, { playerId: pid(1) });
    await first.leave(true);
    await waitUntil(() => stateOf(room).players.size === 0, "left");
    await sleep(100);
    await t.join(room, { playerId: pid(1) });
    await sleep(500);
    expect(alive(room.roomId)).toBe(true);
  });

  it("does not keep a room alive for a spectator alone", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 150 });
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(9), spectator: true });
    await waitUntil(() => !alive(room.roomId), "disposed");
  });

  it("disposes after the last player leaves while a spectator is still watching", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 150 });
    const room = await t.createRoom("buzzer");
    const tv = await t.join(room, { playerId: pid(9), spectator: true });
    const watcherLeft = new Promise<void>((resolve) => tv.onLeave(() => resolve()));
    const player = await t.join(room, { playerId: pid(1) });
    await sleep(300);
    expect(alive(room.roomId)).toBe(true);
    await player.leave(true);
    await waitUntil(() => !alive(room.roomId), "disposed");
    await watcherLeft;
  });

  it("a player joining during the grace period saves a room a spectator is watching", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 400 });
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(9), spectator: true });
    await sleep(150);
    await t.join(room, { playerId: pid(1) });
    await sleep(700);
    expect(alive(room.roomId)).toBe(true);
  });

  it("a reconnect cancels the pending disposal", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 400, reconnectMs: 3000 });
    const room = await t.createRoom("buzzer");
    const client = await t.join(room, { playerId: pid(1) });
    const token = client.reconnectionToken;
    await client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === false, "dropped");
    await t.sdk.reconnect(token);
    await sleep(700);
    expect(alive(room.roomId)).toBe(true);
  });

  it("survives a pending reconnection when the room is disposed underneath it", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 100, reconnectMs: 5000 });
    const room = await t.createRoom("buzzer");
    const client = await t.join(room, { playerId: pid(1) });
    await client.leave(false);
    await waitUntil(() => !alive(room.roomId), "disposed");
    expect(t.roomCodeService.resolve(stateOf(room).roomCode)).toBeUndefined();
  });

  it("still disposes when a rejoin presents the wrong seat secret", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 150 });
    const room = await t.createRoom("buzzer");
    const code = stateOf(room).roomCode;
    const first = await t.join(room, { playerId: pid(1) });
    await first.leave(false); // drop; the seat is kept for reconnection and the disposal is armed
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === false, "dropped");
    // Schema-valid (16+ characters) but not pid(1)'s.
    await expect(
      t.sdk.joinById(room.roomId, {
        playerId: pid(1),
        seatSecret: "hijacker-secret-0000",
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).rejects.toMatchObject({ code: CLOSE_CODES.SEAT_TAKEN.code });
    await waitUntil(() => !alive(room.roomId), "disposed");
    expect(t.roomCodeService.resolve(code)).toBeUndefined();
  });

  it("still disposes when a join is refused because every seat is taken", async () => {
    t = await bootBuzzer({ emptyRoomGraceMs: 150, reconnectMs: 5000 });
    const room = await t.createRoom("buzzer");
    const code = stateOf(room).roomCode;
    const first = await t.join(room, { playerId: pid(1) });
    const second = await t.join(room, { playerId: pid(2) });
    const third = await t.join(room, { playerId: pid(3) });
    // Everyone drops: the seats stay for reconnection (the room is still full) and disposal arms.
    await first.leave(false);
    await second.leave(false);
    await third.leave(false);
    await waitUntil(
      () =>
        stateOf(room).players.get(pid(1))?.isConnected === false &&
        stateOf(room).players.get(pid(2))?.isConnected === false &&
        stateOf(room).players.get(pid(3))?.isConnected === false,
      "dropped",
    );
    await expect(t.join(room, { playerId: pid(4) })).rejects.toMatchObject({
      code: CLOSE_CODES.ROOM_FULL.code,
    });
    await waitUntil(() => !alive(room.roomId), "disposed");
    expect(t.roomCodeService.resolve(code)).toBeUndefined();
  });

  it("still disposes when the first joiner's name is refused by the text filter", async () => {
    t = await bootTestServer({
      games: [{ roomName: "filtered", definition: FilteredGame, stateClass: BaseGameState }],
      textFilter: createTextFilter(),
      emptyRoomGraceMs: 150,
    });
    const room = await t.createRoom("filtered");
    const code = lockedStateOf(room).roomCode;
    await expect(t.join(room, { playerId: pid(1), name: "fuck" })).rejects.toMatchObject({
      code: CLOSE_CODES.CONTENT_REJECTED.code,
    });
    await waitUntil(() => !alive(room.roomId), "disposed");
    expect(t.roomCodeService.resolve(code)).toBeUndefined();
  });
});

describe("GameRoom creation failure", () => {
  const internal = { code: CLOSE_CODES.INTERNAL.code, message: CLOSE_CODES.INTERNAL.message };

  it("closes with INTERNAL and unregisters nothing when no code can be generated", async () => {
    class FullCodeService extends RoomCodeService {
      override generateCode(): string {
        throw new Error("no free code");
      }
    }
    const service = new FullCodeService();
    const unregister = vi.spyOn(service, "unregister");
    t = await bootBuzzer({ roomCodeService: service });
    await expect(t.createRoom("buzzer")).rejects.toMatchObject(internal);
    expect(unregister).not.toHaveBeenCalled();
  });

  it("releases the code when a later step fails", async () => {
    const ThrowingGame = defineGame<BaseGameState, Record<string, never>, Record<string, never>>({
      name: "Throwing",
      version: "1",
      minPlayers: 1,
      maxPlayers: 2,
      startPhase: "Play",
      createPrivateState: () => {
        throw new Error("boom");
      },
      phases: { Play: {} },
    });
    t = await bootBuzzer({
      games: [{ roomName: "throwing", definition: ThrowingGame, stateClass: BaseGameState }],
    });
    const register = vi.spyOn(t.roomCodeService, "generateAndRegister");
    await expect(t.createRoom("throwing")).rejects.toMatchObject(internal);
    const code = register.mock.results[0]?.value;
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(t.roomCodeService.resolve(code)).toBeUndefined();
  });
});
