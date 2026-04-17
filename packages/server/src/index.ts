import { BunWebSockets } from "@colyseus/bun-websockets";
import type { GameDefinition } from "@partygame/core";
// @ts-expect-error - Bun runtime does not have TypeScript declarations in npm
import { serve } from "bun";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";
import { RoomCodeService } from "./services/RoomCodeService.js";

const port = Number(process.env.PORT) || 2567;
const apiPort = 3001;
const roomCodeService = new RoomCodeService();

const gameServer = new Server({
  transport: new BunWebSockets({ path: "/" }),
});

// HTTP API server for code resolution
const _apiServer = serve({
  port: apiPort,
  fetch(req: Request) {
    const url = new URL(req.url);
    if (url.pathname === "/api/resolve-code") {
      if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }
      const code = url.searchParams.get("code");
      if (!code || typeof code !== "string" || !/^[A-Z]{4}$/.test(code)) {
        return new Response(
          JSON.stringify({ error: "Invalid code format. Must be 4 uppercase letters." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      const roomId = roomCodeService.resolve(code);
      if (!roomId) {
        return new Response(JSON.stringify({ error: "Game code not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ roomId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.info(`[API] Code resolution server listening on port ${apiPort}`);

async function start() {
  const witClashPath = "../../../games/wit-clash/index.js";
  const { WitClashGame } = (await import(witClashPath)) as {
    WitClashGame: GameDefinition<unknown>;
  };

  class WitClashRoom extends GameRoom {
    constructor() {
      super(roomCodeService);
    }

    onCreate() {
      this.setDefinition(WitClashGame);
      super.onCreate();
    }
  }

  gameServer.define("wit_clash", WitClashRoom);
  gameServer.listen(port);
  console.info(`[GameServer] Listening on port ${port}`);
}

start();
