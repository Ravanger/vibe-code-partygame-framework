import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock must be BEFORE any imports that transitively use @colyseus/tools
vi.mock("@colyseus/tools", () => ({
  default: {},
  listen: () => {
    throw new Error("unused in tests");
  },
}));

import type { ColyseusTestServer } from "@colyseus/testing";
import { bootTestServer, seatPlayers, sleep } from "./harness.js";

describe("Test Harness", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await bootTestServer();
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("boots, seats three players and reports them in state", async () => {
    const room = await colyseus.createRoom("wit_clash", {});
    const clients = await seatPlayers(colyseus, room, 3);
    expect(room.state.players.size).toBe(3);
    // First player should be host
    expect(
      [...room.state.players.values()].filter((p: { role: string }) => p.role === "host"),
    ).toHaveLength(1);
    // Should have 3 clients
    expect(clients).toHaveLength(3);
  });

  it("sleep helper works", async () => {
    await sleep(10);
    // If we get here, sleep worked
    expect(true).toBe(true);
  });
});
