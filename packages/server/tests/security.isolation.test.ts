import type { Room } from "@colyseus/core";
import { actionLogMiddleware, type GameRuntime, getActionLog, required } from "@partygame/core";
import { CLIENT_MESSAGES, CLOSE_CODES } from "@partygame/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GameRoom } from "../src/rooms/GameRoom.js";
import type { TestServer } from "../src/testing/index.js";
import { bootTestServer, waitUntil } from "../src/testing/index.js";
import {
  BUZZER_PUBLIC_FIELDS,
  BuzzerGame,
  type BuzzerOptions,
  type BuzzerPrivate,
  BuzzerState,
} from "./fixtures/buzzer.js";
import { clientState, pid, seat, stateOf } from "./support.js";

/** The buzzer with the action log middleware: the log lives in priv and records the room's seed. */
const LOGGED_BUZZER: typeof BuzzerGame = { ...BuzzerGame, middleware: [actionLogMiddleware()] };

const GAMES = [
  {
    roomName: "buzzer",
    definition: BuzzerGame,
    stateClass: BuzzerState,
    publicFields: BUZZER_PUBLIC_FIELDS,
  },
  {
    roomName: "logged",
    definition: LOGGED_BUZZER,
    stateClass: BuzzerState,
    publicFields: BUZZER_PUBLIC_FIELDS,
  },
];

let t: TestServer;
beforeAll(async () => {
  t = await bootTestServer({ games: GAMES });
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

/** The room's runtime (a private field); the seed and priv assertions read it directly. */
const runtimeOf = (room: Room): GameRuntime<BuzzerState, BuzzerPrivate, BuzzerOptions> =>
  Reflect.get(room as GameRoom, "runtime") as GameRuntime<
    BuzzerState,
    BuzzerPrivate,
    BuzzerOptions
  >;

describe("security isolation", () => {
  it("an action in room A changes nothing in room B", async () => {
    const roomA = await t.createRoom("buzzer", { buzzMs: 60_000 });
    const roomB = await t.createRoom("buzzer");
    const a1 = await seat(t, roomA, 1);
    await seat(t, roomA, 2);
    await seat(t, roomB, 3);
    await seat(t, roomB, 4);
    await waitUntil(
      () => stateOf(roomA).phase === "Buzz" && stateOf(roomB).phase === "Buzz",
      "both rooms started",
    );
    const luckyB = stateOf(roomB).lucky;

    a1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(roomA).winner === pid(1), "room A changed");

    expect(JSON.parse(stateOf(roomA).options).buzzMs).toBe(60_000);
    const b = stateOf(roomB);
    expect(b.phase).toBe("Buzz");
    expect(b.winner).toBe("");
    expect(b.buzzCount).toBe(0);
    expect(b.lucky).toBe(luckyB);
    expect(JSON.parse(b.options).buzzMs).toBe(10_000);
    expect([...b.players.keys()].sort()).toEqual([pid(3), pid(4)]);
  });

  it("a session only talks to its own room: no cross-room state or messages", async () => {
    const roomA = await t.createRoom("buzzer", { buzzMs: 60_000 });
    const roomB = await t.createRoom("buzzer");
    const a1 = await seat(t, roomA, 1);
    await seat(t, roomA, 2);
    const b1 = await seat(t, roomB, 3);
    const b2 = await seat(t, roomB, 4);
    await waitUntil(
      () =>
        clientState(a1.client).phase === "Buzz" &&
        clientState(b1.client).phase === "Buzz" &&
        clientState(b2.client).phase === "Buzz",
      "all clients synced in Buzz",
    );

    a1.client.send("ACTION", { type: "BUZZ" });
    a1.client.send("ACTION", { type: "JUNK" });
    await waitUntil(() => clientState(a1.client).winner === pid(1), "a1 sees its own room change");
    await waitUntil(() => a1.errors.length === 1, "a1 got its junk error");

    expect(clientState(b1.client).winner).toBe("");
    expect(clientState(b1.client).buzzCount).toBe(0);
    expect(clientState(b2.client).winner).toBe("");
    expect(b1.errors).toHaveLength(0);
    expect(b2.errors).toHaveLength(0);
  });

  it("room codes resolve to their own room only and die with the room", async () => {
    const roomA = await t.createRoom("buzzer");
    const roomB = await t.createRoom("buzzer");
    const codeA = stateOf(roomA).roomCode;
    const codeB = stateOf(roomB).roomCode;

    expect(codeA).not.toBe(codeB);
    expect(t.roomCodeService.resolve(codeA)).toBe(roomA.roomId);
    expect(t.roomCodeService.resolve(codeB)).toBe(roomB.roomId);
    expect(t.roomCodeService.resolveByRoomId(roomB.roomId)).toBe(codeB);

    await roomA.disconnect();
    expect(t.roomCodeService.resolve(codeA)).toBeUndefined();
    expect(t.roomCodeService.resolveByRoomId(roomA.roomId)).toBeUndefined();
    expect(t.roomCodeService.resolve(codeB)).toBe(roomB.roomId);
  });

  it("no .view() entry reaches a spectator or another player, before or after reconnect", async () => {
    const room = await t.createRoom("buzzer", { buzzMs: 60_000 });
    const p1 = await seat(t, room, 1);
    const p2 = await seat(t, room, 2);
    await waitUntil(
      () =>
        clientState(p1.client).secrets?.size === 1 && clientState(p2.client).secrets?.size === 1,
      "both players hold their own secret",
    );
    expect([...clientState(p1.client).secrets.keys()]).toEqual([pid(1)]);
    expect([...clientState(p2.client).secrets.keys()]).toEqual([pid(2)]);

    const spec = await t.join(room, { playerId: "spectator-0001", spectator: true });
    await waitUntil(() => clientState(spec).phase === "Buzz", "spectator synced");
    expect(clientState(spec).secrets?.size ?? 0).toBe(0);

    await p1.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === false, "p1 dropped");
    const p1Back = await t.join(room, { playerId: pid(1) });
    await waitUntil(() => clientState(p1Back).secrets?.size === 1, "p1's view re-applied");

    expect([...clientState(p1Back).secrets.keys()]).toEqual([pid(1)]);
    expect(clientState(p1Back).secrets.get(pid(1))?.word).toBe(`secret-${pid(1)}`);
    expect([...clientState(p2.client).secrets.keys()]).toEqual([pid(2)]);
    expect(clientState(spec).secrets?.size ?? 0).toBe(0);
  });

  it("after hideFrom and seat removal, the removed client gets no further updates for that entry", async () => {
    const room = await t.createRoom("buzzer", { buzzMs: 60_000 });
    const p1 = await seat(t, room, 1);
    const p2 = await seat(t, room, 2);
    await waitUntil(() => clientState(p2.client).secrets?.size === 1, "p2 holds its secret");

    p1.client.send("ACTION", { type: "BUZZ" });
    p2.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done");
    // RESET returns to the lobby; onReturnToLobby hides every secret from its owner, then clears.
    p1.client.send("ACTION", { type: "RESET" });
    await waitUntil(() => (clientState(p2.client).secrets?.size ?? 0) === 0, "p2's entry hidden");

    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => p2.errors.length === 1, "kicked");
    expect(p2.errors[0]).toEqual({ code: "KICKED", message: CLIENT_MESSAGES.KICKED });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    await waitUntil(() => room.clients.length === 1, "connection closed");

    expect(clientState(p2.client).secrets?.size ?? 0).toBe(0);
    expect(JSON.stringify(clientState(p2.client))).not.toContain(`secret-${pid(2)}`);
    // The removed player cannot open a fresh session to get the entry back.
    await expect(t.join(room, { playerId: pid(2) })).rejects.toMatchObject({
      code: CLOSE_CODES.KICKED_REJOIN.code,
      message: CLOSE_CODES.KICKED_REJOIN.message,
    });
  });

  it("a fresh room gets a different seed and an empty priv after its predecessor is disposed", async () => {
    const roomA = await t.createRoom("logged");
    const a1 = await seat(t, roomA, 1);
    await seat(t, roomA, 2);
    await waitUntil(() => stateOf(roomA).phase === "Buzz", "room A started");
    a1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(roomA).buzzCount === 1, "room A buzzed");

    const logA = required(getActionLog(runtimeOf(roomA).priv), "room A's action log");
    expect(logA.entries.some((entry) => entry.senderId === pid(1))).toBe(true);
    const seedA = logA.header.seed;

    await roomA.disconnect();

    const roomB = await t.createRoom("logged");
    const privB = runtimeOf(roomB).priv;
    const logB = required(getActionLog(privB), "room B's action log");
    expect(logB.header.seed).not.toEqual(seedA);
    expect(privB.buzzed.size).toBe(0);
    for (const entry of logB.entries) {
      expect(entry.senderId).not.toBe(pid(1));
    }
  });
});
