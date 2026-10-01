import { matchMaker } from "@colyseus/core";
import { afterEach, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { sleep, waitUntil } from "../src/testing/index.js";
import { bootBuzzer, pid, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

const alive = (roomId: string) => matchMaker.getLocalRoomById(roomId) !== undefined;

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
});
