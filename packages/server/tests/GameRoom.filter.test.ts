import { createTextFilter } from "@partygame/content/filter";
import { defineGame } from "@partygame/core";
import { CLOSE_CODES } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { TestServer } from "../src/testing/index.js";
import { bootTestServer, collectMessages, waitUntil } from "../src/testing/index.js";
import { PlainGame } from "./fixtures/buzzer.js";
import { pid, stateOf } from "./support.js";

interface FilteredOptions {
  level: "off" | "moderate" | "strict";
}

const FilteredGame = defineGame<BaseGameState, Record<string, never>, FilteredOptions>({
  name: "Filtered",
  version: "1",
  minPlayers: 1,
  maxPlayers: 3,
  startPhase: "Play",
  options: z.object({ level: z.enum(["off", "moderate", "strict"]).default("moderate") }),
  filterLevel: (options) => options.level,
  createPrivateState: () => ({}),
  phases: { Play: {} },
});

let filtered: TestServer;
let unfiltered: TestServer;
beforeAll(async () => {
  filtered = await bootTestServer({
    games: [
      { roomName: "filtered", definition: FilteredGame, stateClass: BaseGameState },
      { roomName: "plain", definition: PlainGame, stateClass: BaseGameState },
    ],
    textFilter: createTextFilter(),
  });
  unfiltered = await bootTestServer({
    games: [{ roomName: "unfiltered", definition: PlainGame, stateClass: BaseGameState }],
  });
});
afterEach(() => Promise.all([filtered.cleanup(), unfiltered.cleanup()]));
afterAll(() => Promise.all([filtered.shutdown(), unfiltered.shutdown()]));

describe("GameRoom name filtering", () => {
  it("refuses a join with a filtered name at moderate and seats no one", async () => {
    const room = await filtered.createRoom("filtered");
    await expect(filtered.join(room, { playerId: pid(1), name: "fuck" })).rejects.toMatchObject({
      code: CLOSE_CODES.CONTENT_REJECTED.code,
      message: CLOSE_CODES.CONTENT_REJECTED.message,
    });
    expect(stateOf(room).players.size).toBe(0);
  });

  it("refuses a filtered SET_NAME and keeps the old name and readiness", async () => {
    const room = await filtered.createRoom("filtered");
    const client = await filtered.join(room, { playerId: pid(1) });
    const errors = collectMessages(client, "ERROR");
    client.send("SET_NAME", "Ann");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isReady === true, "ready");
    client.send("SET_NAME", "fuck");
    await waitUntil(() => errors.length === 1, "refused name");
    expect(errors[0]).toEqual({
      code: "CONTENT_REJECTED",
      message: "contains inappropriate language",
    });
    expect(stateOf(room).players.get(pid(1))).toMatchObject({ name: "Ann", isReady: true });
  });

  it("passes clean and mild names at moderate", async () => {
    const room = await filtered.createRoom("filtered");
    await filtered.join(room, { playerId: pid(1), name: "Ann" });
    const guest = await filtered.join(room, { playerId: pid(2) });
    expect(stateOf(room).players.get(pid(1))?.name).toBe("Ann");
    guest.send("SET_NAME", "bastard");
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isReady === true, "mild name ready");
    expect(stateOf(room).players.get(pid(2))?.name).toBe("bastard");
  });

  it("reads the level from the room options: off passes everything", async () => {
    const room = await filtered.createRoom("filtered", { level: "off" });
    const client = await filtered.join(room, { playerId: pid(1), name: "fuck" });
    expect(stateOf(room).players.get(pid(1))?.name).toBe("fuck");
    client.send("SET_NAME", "what the fuck");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.name === "what the fuck", "renamed");
  });

  it("uses the live room options: a raised level applies to the next SET_NAME, not set names", async () => {
    const room = await filtered.createRoom("filtered");
    const host = await filtered.join(room, { playerId: pid(1), name: "Ann" });
    host.send("ACTION", { type: "SET_OPTIONS", level: "strict" });
    await waitUntil(() => JSON.parse(stateOf(room).options).level === "strict", "raised");
    expect(stateOf(room).players.get(pid(1))?.name).toBe("Ann");
    const guest = await filtered.join(room, { playerId: pid(2) });
    const errors = collectMessages(guest, "ERROR");
    guest.send("SET_NAME", "bastard");
    await waitUntil(() => errors.length === 1, "refused name");
    expect(errors[0]).toEqual({ code: "CONTENT_REJECTED", message: "contains strong language" });
    expect(stateOf(room).players.get(pid(2))?.name).toBe("");
  });

  it("leaves names untouched when the game defines no filterLevel", async () => {
    const room = await filtered.createRoom("plain");
    const client = await filtered.join(room, { playerId: pid(1), name: "fuck" });
    expect(stateOf(room).players.get(pid(1))?.name).toBe("fuck");
    client.send("SET_NAME", "what the fuck");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.name === "what the fuck", "renamed");
  });

  it("keeps join and SET_NAME unchanged without a configured filter", async () => {
    const room = await unfiltered.createRoom("unfiltered");
    const client = await unfiltered.join(room, { playerId: pid(1), name: "fuck" });
    expect(stateOf(room).players.get(pid(1))?.name).toBe("fuck");
    client.send("SET_NAME", "what the fuck");
    await waitUntil(() => stateOf(room).players.get(pid(1))?.name === "what the fuck", "renamed");
  });
});
