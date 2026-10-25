import type { Server as HttpServer } from "node:http";
import { matchMaker, type Room, type Server } from "@colyseus/core";
import { type Room as ClientRoom, ColyseusSDK } from "@colyseus/sdk";
import { waitFor } from "@partygame/client-utils";
import { PROTOCOL_VERSION } from "@partygame/shared";
import { createGameServer, type GameServerOptions } from "../createGameServer.js";
import { serveApi as serveApiOnNode } from "../node.js";
import { closeHttpServer, freePort } from "../probe.js";
import { RoomCodeService } from "../services/RoomCodeService.js";

/** Poll until `predicate` holds. A patch tick is not a barrier; wait on the condition you care about. */
export function waitUntil(
  predicate: () => boolean,
  label = "condition",
  timeoutMs = 4000,
  stepMs = 10,
): Promise<void> {
  return waitFor(predicate, label, timeoutMs, stepMs);
}

/** Record every message of `type` a client room receives. */
export function collectMessages(client: ClientRoom, type: string): unknown[] {
  const received: unknown[] = [];
  client.onMessage(type, (payload: unknown) => {
    received.push(payload);
  });
  return received;
}

export interface TestJoinOptions {
  playerId: string;
  name?: string;
  spectator?: boolean;
}

/** Servers booted by {@link bootTestServer} that have not been shut down yet. */
const liveTestServers = new Set<TestServer>();

/** A game server on a free port, plus an SDK to talk to it. Always `shutdown()` in `afterAll`. */
export class TestServer {
  private readonly apis: HttpServer[] = [];

  constructor(
    readonly server: Server,
    readonly sdk: ColyseusSDK,
    readonly roomCodeService: RoomCodeService,
    /** WebSocket URL of the booted server, for clients other than `sdk`. */
    readonly endpoint: string,
  ) {}

  private readonly seatSecrets = new Map<string, string>();

  /** The stable per-playerId seat secret this server's joins send; a test reconnect reuses it. */
  seatSecretFor(playerId: string): string {
    let secret = this.seatSecrets.get(playerId);
    if (secret === undefined) {
      secret = crypto.randomUUID() + crypto.randomUUID();
      this.seatSecrets.set(playerId, secret);
    }
    return secret;
  }

  /** Create a room server-side; resolves with the live room object for state inspection. */
  async createRoom(roomName: string, options: Record<string, unknown> = {}): Promise<Room> {
    const listing = await matchMaker.createRoom(roomName, {
      ...options,
      protocolVersion: PROTOCOL_VERSION,
    });
    return matchMaker.getLocalRoomById(listing.roomId) as Room;
  }

  /** Join `room` as a player (or a spectator). Send `SET_NAME` yourself to become ready. */
  join(room: Room, options: TestJoinOptions): Promise<ClientRoom> {
    return this.sdk.joinById(room.roomId, {
      ...options,
      seatSecret: this.seatSecretFor(options.playerId),
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  /** Like {@link TestServer.join}, with the client state typed as `stateClass`. */
  joinAs<TState>(
    room: Room,
    options: TestJoinOptions,
    stateClass: new () => TState,
  ): Promise<ClientRoom<unknown, TState>> {
    return this.sdk.joinById<TState>(
      room.roomId,
      {
        ...options,
        seatSecret: this.seatSecretFor(options.playerId),
        protocolVersion: PROTOCOL_VERSION,
      },
      stateClass,
    );
  }

  /** Start the `/api/resolve-code` HTTP API for this server's rooms on a free port; stopped by `shutdown()`. */
  async serveApi(): Promise<number> {
    const port = await freePort();
    this.apis.push(
      await serveApiOnNode(this.roomCodeService, {
        port,
        host: "127.0.0.1",
        // Suites resolve codes rapidly from one address; keep the production throttle from tripping.
        rateLimits: { resolveCode: { rate: 100, burst: 1000 } },
      }),
    );
    return port;
  }

  /** Dispose every room; call between tests that share a server. */
  async cleanup(): Promise<void> {
    await Promise.all(matchMaker.disconnectAll());
  }

  async shutdown(): Promise<void> {
    liveTestServers.delete(this);
    await Promise.all(
      this.apis.map((api) => {
        api.closeAllConnections();
        return closeHttpServer(api);
      }),
    );
    await this.server.gracefullyShutdown(false);
  }
}

/** Boot a server for `options.games` with no transport override. Defaults are short so tests stay fast. Only one may be live per process. */
export async function bootTestServer(
  options: Omit<GameServerOptions, "transport">,
): Promise<TestServer> {
  if (liveTestServers.size > 0) {
    throw new Error(
      "bootTestServer: only one test server may be live per process; call shutdown() first",
    );
  }
  const roomCodeService = options.roomCodeService ?? new RoomCodeService();
  const server = createGameServer({
    reconnectMs: 1000,
    emptyRoomGraceMs: 30_000,
    ...options,
    roomCodeService,
  });
  const port = await freePort();
  await server.listen(port);
  const endpoint = `ws://127.0.0.1:${port}`;
  const testServer = new TestServer(server, new ColyseusSDK(endpoint), roomCodeService, endpoint);
  liveTestServers.add(testServer);
  return testServer;
}

export {
  collectErrors,
  joinPlayer,
  type SeatPlayersOptions,
  seatPlayers,
  stateOf,
  TestPlayer,
  testPlayerId,
} from "./players.js";
