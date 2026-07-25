import { vi } from "vitest";

vi.mock("@colyseus/tools", () => ({
  default: {},
  listen: () => {
    throw new Error("unused in tests");
  },
}));

import type { Room as ColyseusServerRoom } from "@colyseus/core";
import type { Room as ColyseusClientRoom } from "@colyseus/sdk";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { WitClashGame } from "../../../../games/wit-clash/index.js";
import { createGameServer, TEST_DURATIONS } from "../../src/createGameServer.js";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";
import { CategoryRepository } from "../../src/services/CategoryRepository.js";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Category {
  id: string;
  name: string;
  emoji: string;
  tieBreakers: string[];
  prompts: Array<{ id: string; text: string }>;
}

/** Deterministic categories — never read the real content directory in tests. */
export function testCategories() {
  const categories: Category[] = [
    {
      id: "alpha",
      name: "Alpha",
      emoji: "🅰️",
      tieBreakers: [],
      prompts: Array.from({ length: 8 }, (_, i) => ({
        id: `a${i}`,
        text: `Alpha prompt ${i}`,
      })),
    },
    {
      id: "beta",
      name: "Beta",
      emoji: "🅱️",
      tieBreakers: [],
      prompts: Array.from({ length: 8 }, (_, i) => ({
        id: `b${i}`,
        text: `Beta prompt ${i}`,
      })),
    },
    {
      id: "gamma",
      name: "Gamma",
      emoji: "🇬",
      tieBreakers: [],
      prompts: Array.from({ length: 8 }, (_, i) => ({
        id: `g${i}`,
        text: `Gamma prompt ${i}`,
      })),
    },
    {
      id: "delta",
      name: "Delta",
      emoji: "🇩",
      tieBreakers: [],
      prompts: Array.from({ length: 8 }, (_, i) => ({
        id: `d${i}`,
        text: `Delta prompt ${i}`,
      })),
    },
  ];
  return categories;
}

/**
 * Boot a test server with WitClash game definition.
 */
export async function bootTestServer(durations?: PhaseDurations): Promise<ColyseusTestServer> {
  const categories = CategoryRepository.fromArray(testCategories());
  return boot(
    createGameServer({
      categories,
      durations: durations ?? TEST_DURATIONS,
      gameDefinition: WitClashGame,
    }),
  );
}

/**
 * Seat N players in a room and return their client connections.
 * Each player is assigned a unique UUID and name (P1, P2, ..., PN).
 * The first player is assigned the "host" role.
 */
export async function seatPlayers(
  colyseus: ColyseusTestServer,
  room: ColyseusServerRoom,
  n: number,
): Promise<ColyseusClientRoom[]> {
  const clients: ColyseusClientRoom[] = [];
  for (let i = 0; i < n; i++) {
    const c = await colyseus.connectTo(room, { playerId: `uuid-${i}` });
    c.send("SET_NAME", `P${i + 1}`);
    clients.push(c);
  }
  await room.waitForNextPatch();
  return clients;
}

export type ColyseusTestServerType = ColyseusTestServer;
