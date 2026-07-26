import {
  type Room as ColyseusServerRoom,
  Deferred,
  matchMaker,
  Room,
  type Server,
} from "@colyseus/core";
import { Room as ColyseusClientRoom, ColyseusSDK } from "@colyseus/sdk";

// Patch Room and ClientRoom prototypes (mirrors @colyseus/testing Room.ext.mjs)
// so tests can use waitForNextPatch, waitForMessage, etc.
const _originalBroadcastPatch = Room.prototype.broadcastPatch;
Room.prototype.broadcastPatch = function () {
  const retVal = _originalBroadcastPatch.call(this);
  if (this._waitingForPatch) {
    setTimeout(() => this._waitingForPatch[1].resolve(), this._waitingForPatch[0]);
  }
  return retVal;
};
(Room.prototype as any).waitForNextPatch = async function (additionalDelay = 0) {
  this._waitingForPatch = [additionalDelay, new Deferred()];
  return this._waitingForPatch[1];
};

const _originalClientPatch = ColyseusClientRoom.prototype.patch;
(ColyseusClientRoom.prototype as any).patch = function () {
  _originalClientPatch.apply(this, arguments);
  if (this._waitingForPatch) {
    setTimeout(() => {
      this._waitingForPatch[1].resolve([arguments[0], arguments[1]]);
    }, this._waitingForPatch[0]);
  }
};
(ColyseusClientRoom.prototype as any).waitForNextPatch = async function (additionalDelay = 0) {
  this._waitingForPatch = [additionalDelay, new Deferred()];
  return this._waitingForPatch[1];
};

// Override leave() to accept boolean consented flag (like @colyseus/testing)
// true = consented (sends LEAVE_ROOM protocol), false = not consented (closes connection)
const _originalClientLeave = ColyseusClientRoom.prototype.leave;
(ColyseusClientRoom.prototype as any).leave = async function (consentedOrCode?: boolean | number) {
  if (typeof consentedOrCode === "boolean") {
    // Boolean mode: pass directly to SDK which handles LEAVE_ROOM vs close()
    return _originalClientLeave.call(this, consentedOrCode);
  }
  // Number mode: treat as boolean (non-zero = true)
  return _originalClientLeave.call(this, !!consentedOrCode);
};

const DEFAULT_TEST_PORT = 2568;

/**
 * Minimal test server harness that avoids @colyseus/testing entirely.
 * @colyseus/testing imports @colyseus/tools at module load time, which uses
 * require() in a .mjs file and fails under both Bun and Node in this repo.
 */
export class ColyseusTestServer {
  public readonly sdk: ColyseusSDK;
  public readonly http: Record<string, (path: string, opts?: unknown) => Promise<unknown>>;

  constructor(private readonly server: Server) {
    const hostname = "127.0.0.1";
    const port = server.port as number;
    this.sdk = new ColyseusSDK(`ws://${hostname}:${port}`);
    const httpEndpoint = `http://${hostname}:${port}`;
    this.http = {
      get: (segments: string, opts?: unknown) =>
        fetch(`${httpEndpoint}${segments}`, { method: "GET", ...(opts as RequestInit) }).then((r) =>
          r.json(),
        ),
      post: (segments: string, opts?: unknown) =>
        fetch(`${httpEndpoint}${segments}`, { method: "POST", ...(opts as RequestInit) }).then(
          (r) => r.json(),
        ),
    };
  }

  async createRoom(roomName: string, clientOptions: Record<string, unknown> = {}) {
    const room = await matchMaker.createRoom(roomName, clientOptions);
    return this.getRoomById(room.roomId);
  }

  connectTo(room: ColyseusServerRoom, clientOptions: Record<string, unknown> = {}) {
    return this.sdk.joinById(room.roomId, clientOptions);
  }

  getRoomById(roomId: string) {
    return matchMaker.getLocalRoomById(roomId);
  }

  async cleanup() {
    await Promise.all(matchMaker.disconnectAll());
  }

  async shutdown() {
    await this.server.gracefullyShutdown(false);
  }
}

export type ColyseusTestServerType = ColyseusTestServer;

export async function boot(gameServer: Server): Promise<ColyseusTestServer> {
  await gameServer.listen(DEFAULT_TEST_PORT);
  return new ColyseusTestServer(gameServer);
}

import { WitClashGame } from "../../../../games/wit-clash/index.js";
import { CategoryRepository } from "../../../../games/wit-clash/src/content/CategoryRepository.js";
import { createGameServer, TEST_DURATIONS } from "../../src/createGameServer.js";
import type { PhaseDurations } from "../../src/rooms/GameRoom.js";

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
  // No transport passed - Server uses @colyseus/ws-transport as default
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
