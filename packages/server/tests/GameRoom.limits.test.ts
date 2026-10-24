import { CLOSE_CODES } from "@partygame/shared";
import { afterEach, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { bootBuzzer, pid, stateOf } from "./support.js";

let t: TestServer | undefined;
afterEach(async () => {
  await t?.shutdown();
  t = undefined;
});

describe("GameRoom room limits", () => {
  it("refuses a create past maxRooms with SERVER_FULL and leaves existing rooms working", async () => {
    t = await bootBuzzer({ maxRooms: 2 });
    const r1 = await t.createRoom("buzzer");
    const r2 = await t.createRoom("buzzer");
    await expect(t.createRoom("buzzer")).rejects.toMatchObject({
      code: CLOSE_CODES.SERVER_FULL.code,
      message: CLOSE_CODES.SERVER_FULL.message,
    });
    // the two existing rooms keep working
    await t.join(r1, { playerId: pid(1) });
    expect(stateOf(r1).players.size).toBe(1);
    await t.join(r2, { playerId: pid(1) });
    expect(stateOf(r2).players.size).toBe(1);
  });

  it("frees a slot when a room is disposed", async () => {
    t = await bootBuzzer({ maxRooms: 2 });
    const r1 = await t.createRoom("buzzer");
    await t.createRoom("buzzer");
    await r1.disconnect(); // disconnects its clients and disposes the room
    const created = await t.createRoom("buzzer");
    expect(t.roomCodeService.resolve(stateOf(created).roomCode)).toBe(created.roomId);
  });

  it("allows the default of 100 rooms and refuses the 101st", async () => {
    t = await bootBuzzer();
    for (let i = 0; i < 100; ++i) await t.createRoom("buzzer");
    await expect(t.createRoom("buzzer")).rejects.toMatchObject({
      code: CLOSE_CODES.SERVER_FULL.code,
      message: CLOSE_CODES.SERVER_FULL.message,
    });
  });
});
