import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock must be BEFORE any imports that transitively use @colyseus/tools
vi.mock("@colyseus/tools", () => ({
  default: {},
  listen: () => {
    throw new Error("unused in tests");
  },
}));

import type { ColyseusTestServer } from "@colyseus/testing";
import { bootTestServer, seatPlayers, sleep, waitUntil } from "./harness.js";

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

  it("sleep helper waits at least the requested time", async () => {
    const before = Date.now();
    await sleep(25);
    expect(Date.now() - before).toBeGreaterThanOrEqual(20);
  });

  it("waitUntil resolves once the condition holds and throws when it never does", async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 20);
    await waitUntil(() => flag, "flag set");
    expect(flag).toBe(true);
    await expect(waitUntil(() => false, "never", 60, 10)).rejects.toThrow(/never/);
  });
});
