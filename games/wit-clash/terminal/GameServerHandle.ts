import type { Server as HttpServer } from "node:http";
import type { Server } from "@colyseus/core";
import { createGameServer, RoomCodeService } from "@partygame/server";
import { freePort, serveApi } from "@partygame/server/node";
import type { CategoryRepository } from "../src/content/CategoryRepository.js";
import { createWitClashGame } from "../src/game.js";
import { ROOM_NAME } from "../src/roomName.js";
import { WitClashState } from "../src/state.js";

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
      this.port = this.wanted.port ?? (await freePort());
      this.apiPort = this.wanted.apiPort ?? (await freePort());
      const roomCodeService = new RoomCodeService();
      this.api = await serveApi(roomCodeService, { port: this.apiPort });
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
}
