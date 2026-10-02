import { BaseGameState } from "@partygame/shared/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bootTestServer,
  joinPlayer,
  seatPlayers,
  sleep,
  stateOf,
  type TestServer,
  testPlayerId,
  waitUntil,
} from "../src/testing/index.js";
import { BuzzerGame, BuzzerState, PlainGame } from "./fixtures/buzzer.js";

let t: TestServer;

beforeAll(async () => {
  t = await bootTestServer({
    games: [
      { roomName: "buzzer", definition: BuzzerGame, stateClass: BuzzerState },
      { roomName: "plain", definition: PlainGame, stateClass: BaseGameState },
    ],
  });
});
afterAll(() => t.shutdown());

describe("testPlayerId", () => {
  it("pads to four digits", () => {
    expect(testPlayerId(1)).toBe("player-0001");
    expect(testPlayerId(12)).toBe("player-0012");
  });
});

describe("seatPlayers", () => {
  it("seats named, ready players and leaves the game in the lobby", async () => {
    const room = await t.createRoom("plain");
    const players = await seatPlayers(t, room, { stateClass: BaseGameState, count: 2 });
    const state = stateOf(room, BaseGameState);
    expect(players.map((p) => p.playerId)).toEqual(["player-0001", "player-0002"]);
    expect([...state.players.values()].every((p) => p.isReady)).toBe(true);
    expect(state.players.get("player-0001")?.role).toBe("host");
    expect(state.players.get("player-0002")?.name).toBe("P2");
    expect(state.phase).toBe("Lobby");
    await waitUntil(() => players.every((p) => p.client.state.players.size === 2), "synced");
    expect(players[0]?.client.state.players.size).toBe(2);
  });

  it("starts the game when asked", async () => {
    const room = await t.createRoom("plain");
    await seatPlayers(t, room, { stateClass: BaseGameState, count: 2, start: true });
    await waitUntil(() => stateOf(room, BaseGameState).phase === "Play", "play");
  });

  it("numbers from `from`", async () => {
    const room = await t.createRoom("buzzer");
    const [only] = await seatPlayers(t, room, { stateClass: BuzzerState, count: 1, from: 4 });
    expect(only?.playerId).toBe("player-0004");
  });
});

describe("joinPlayer and TestPlayer", () => {
  it("joins unready until it is named", async () => {
    const room = await t.createRoom("buzzer");
    const state = stateOf(room, BuzzerState);
    const player = await joinPlayer(t, room, 7, BuzzerState);
    expect(state.players.get("player-0007")?.isReady).toBe(false);
    player.setName("Zed");
    await waitUntil(() => state.players.get("player-0007")?.isReady === true, "named");
    expect(state.players.get("player-0007")?.name).toBe("Zed");
  });

  it("collects the errors of rejected actions", async () => {
    const room = await t.createRoom("buzzer");
    const [p] = await seatPlayers(t, room, { stateClass: BuzzerState, count: 1 });
    p?.act("NOPE");
    await waitUntil(() => (p?.errors.length ?? 0) > 0, "error");
    expect(p?.errors[0]?.code).toBe("UNKNOWN_ACTION");
  });
});

describe("collectErrors", () => {
  it("ignores an ERROR payload that is not a ServerError", async () => {
    const room = await t.createRoom("buzzer");
    const [p, q] = await seatPlayers(t, room, { stateClass: BuzzerState, count: 2 });
    await waitUntil(() => stateOf(room, BuzzerState).phase === "Buzz", "buzz");
    p?.act("JUNK");
    q?.act("NOPE");
    await waitUntil(() => (q?.errors.length ?? 0) > 0, "error");
    await sleep(50);
    expect(p?.errors).toEqual([]);
  });
});

describe("stateOf", () => {
  it("throws when the room runs another state class", async () => {
    const plain = await t.createRoom("plain");
    expect(() => stateOf(plain, BuzzerState)).toThrow("Room state is not a BuzzerState");
  });
});
