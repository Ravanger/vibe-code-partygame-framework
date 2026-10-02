import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { bootBuzzer, pid, stateOf } from "./support.js";

let t: TestServer;
beforeAll(async () => {
  t = await bootBuzzer();
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("GameRoom with a seats list", () => {
  it("seats listed players, refuses other players and admits spectators", async () => {
    const room = await t.createRoom("buzzer", { seats: [pid(1), pid(2)] });
    await t.join(room, { playerId: pid(1) });
    await t.join(room, { playerId: pid(2) });
    await expect(t.join(room, { playerId: pid(3) })).rejects.toThrow("This room is watch-only");
    await t.join(room, { playerId: pid(3), spectator: true });
    expect(stateOf(room).players.size).toBe(2);
    expect(stateOf(room).spectatorCount).toBe(1);
  });

  it("lets the creator take a listed seat, and keeps the list out of the game options", async () => {
    const room = await t.createRoom("buzzer", { playerId: pid(1), seats: [pid(1)], buzzMs: 4000 });
    await t.join(room, { playerId: pid(1) });
    expect(stateOf(room).players.has(pid(1))).toBe(true);
    expect(JSON.parse(stateOf(room).options)).toEqual({ buzzMs: 4000, explodeOnTimeout: false });
  });

  it("refuses everyone who wants a seat when the list is empty", async () => {
    const room = await t.createRoom("buzzer", { seats: [] });
    await expect(t.join(room, { playerId: pid(1) })).rejects.toThrow("This room is watch-only");
  });

  it("rejects a malformed list at creation", async () => {
    await expect(t.createRoom("buzzer", { seats: ["short"] })).rejects.toThrow(
      "Invalid room options",
    );
    await expect(t.createRoom("buzzer", { seats: "player-0001" })).rejects.toThrow(
      "Invalid room options",
    );
  });

  it("is open to everyone without the option", async () => {
    const room = await t.createRoom("buzzer");
    await t.join(room, { playerId: pid(7) });
    expect(stateOf(room).players.has(pid(7))).toBe(true);
  });
});
