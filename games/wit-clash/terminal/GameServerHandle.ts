import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import type { Server } from "@colyseus/core";
import { createApiHandler, createGameServer, RoomCodeService } from "@partygame/server";
import { z } from "zod";
import type { CategoryRepository } from "../src/content/CategoryRepository.js";
import { createWitClashGame } from "../src/game.js";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";

const AddressSchema = z.object({ port: z.number() });

export interface WantedPorts {
  /** Game server port; a free one when omitted. */
  port?: number;
  /** Room-code API port; a free one when omitted. */
  apiPort?: number;
}

/** A WitClash game server and its code API inside this process, for the terminal tools. */
export class GameServerHandle {
  port = 0;
  apiPort = 0;
  private server: Server | undefined;
  private api: HttpServer | undefined;

  constructor(
    private readonly categories: CategoryRepository,
    private readonly wanted: WantedPorts = {},
  ) {}

  get endpoint(): string {
    return `ws://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    try {
      this.port = this.wanted.port ?? (await this.freePort());
      this.apiPort = this.wanted.apiPort ?? (await this.freePort());
      const roomCodeService = new RoomCodeService();
      const handler = createApiHandler(roomCodeService);
      const api = createHttpServer(async (req, res) => {
        const response = handler(new Request(`http://127.0.0.1${req.url}`));
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
      });
      this.api = api;
      await new Promise<void>((resolve, reject) => {
        api.once("error", reject);
        api.listen(this.apiPort, resolve);
      });
      this.server = createGameServer({
        games: [
          {
            roomName: ROOM_NAME,
            definition: createWitClashGame({ categories: this.categories }),
            stateClass: WitClashState,
          },
        ],
        roomCodeService,
      });
      await this.server.listen(this.port);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const { api, server } = this;
    this.api = undefined;
    this.server = undefined;
    if (api) {
      api.closeAllConnections();
      await new Promise((resolve) => api.close(resolve));
    }
    await server?.gracefullyShutdown(false);
  }

  private async freePort(): Promise<number> {
    const probe = createSocketServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const { port } = AddressSchema.parse(probe.address());
    await new Promise((resolve) => probe.close(resolve));
    return port;
  }
}
