import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import type { Server } from "@colyseus/core";
import { createApiHandler } from "./api/createApiHandler.js";
import { createGameServer, type GameServerOptions } from "./createGameServer.js";
import { closeHttpServer, freePort } from "./probe.js";
import { RoomCodeService } from "./services/RoomCodeService.js";

export interface ServeApiOptions {
  port: number;
  /** Interface to bind; every interface when omitted. */
  host?: string;
}

/** Serves `/api/resolve-code` for `codes` on Node's `http` (the Bun entry has its own). Close the returned server to stop it. */
export async function serveApi(
  codes: RoomCodeService,
  options: ServeApiOptions,
): Promise<HttpServer> {
  const handler = createApiHandler(codes);
  const api = createHttpServer(async (req, res) => {
    const response = handler(new Request(`http://127.0.0.1${req.url}`));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  });
  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(options.port, options.host, resolve);
  });
  return api;
}

export interface NodeServerOptions extends Omit<GameServerOptions, "transport"> {
  /** Game server port; a free one when omitted. */
  port?: number;
  /** Code API port; a free one when omitted. */
  apiPort?: number;
  /** Interface the code API binds; every interface when omitted. */
  host?: string;
}

/** A game server and its code API running in this process. */
export class NodeServerHandle {
  private stopped = false;

  constructor(
    readonly server: Server,
    private readonly api: HttpServer,
    readonly roomCodeService: RoomCodeService,
    readonly port: number,
    readonly apiPort: number,
  ) {}

  get endpoint(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  /** Closes the API and the game server; calling it again does nothing. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.api.closeAllConnections();
    await closeHttpServer(this.api);
    await this.server.gracefullyShutdown(false);
  }
}

// Colyseus `listen` hangs instead of rejecting on a taken port, so check first.
async function claimPort(port: number): Promise<void> {
  const probe = createSocketServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}

const MAX_PORT_ATTEMPTS = 5;

/** True for the EADDRINUSE a failed `listen` reports when a port was taken after we checked it. */
function isEaddrinuse(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "EADDRINUSE";
}

/** Runs the game server and its code API in this process, on the given ports or free ones. A free port that gets taken in the meantime is re-rolled (up to five attempts); a given port that is taken rejects immediately, leaving nothing open either way. */
export async function startNodeServer(
  options: NodeServerOptions,
  /** Test seam: overrides how free ports are discovered. */
  hooks?: { freePort?: () => Promise<number> },
): Promise<NodeServerHandle> {
  const { port: wantedPort, apiPort: wantedApiPort, host, ...serverOptions } = options;
  if (wantedPort !== undefined && wantedPort === wantedApiPort) {
    throw new Error("The game server and the code API need different ports");
  }
  const roomCodeService = options.roomCodeService ?? new RoomCodeService();
  const discoverFreePort = hooks?.freePort ?? freePort;
  for (let attempt = 1; ; ++attempt) {
    const port = wantedPort ?? (await discoverFreePort());
    const apiPort = wantedApiPort ?? (await discoverFreePort());
    let api: HttpServer | undefined;
    let server: Server | undefined;
    try {
      await claimPort(port);
      api = await serveApi(
        roomCodeService,
        host === undefined ? { port: apiPort } : { port: apiPort, host },
      );
      server = createGameServer({ ...serverOptions, roomCodeService });
      await server.listen(port);
      return new NodeServerHandle(server, api, roomCodeService, port, apiPort);
    } catch (error) {
      // A failed `listen` leaves no listening server behind; only close what is open.
      if (api !== undefined) {
        const openApi = api;
        openApi.closeAllConnections();
        await closeHttpServer(openApi);
      }
      await server?.gracefullyShutdown(false);
      const retriable =
        isEaddrinuse(error) && wantedPort === undefined && wantedApiPort === undefined;
      if (!retriable || attempt === MAX_PORT_ATTEMPTS) throw error;
    }
  }
}
