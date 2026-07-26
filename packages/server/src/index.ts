import { join } from "node:path";
import { BunWebSockets } from "@colyseus/bun-websockets";
import type { GameDefinition } from "@partygame/core";
// @ts-expect-error - Bun runtime does not have TypeScript declarations in npm
import { serve } from "bun";
import { Server } from "colyseus";
import { CategoryRepository } from "../../../games/wit-clash/src/content/CategoryRepository.js";
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

    // CORS headers - allow all origins for development
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS for CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/api/resolve-code") {
      if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const code = url.searchParams.get("code");
      if (!code || typeof code !== "string" || !/^[A-Z]{4}$/.test(code)) {
        return new Response(
          JSON.stringify({ error: "Invalid code format. Must be 4 uppercase letters." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
      const roomId = roomCodeService.resolve(code);
      if (!roomId) {
        return new Response(JSON.stringify({ error: "Game code not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({ roomId }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
});

console.info(`[API] Code resolution server listening on port ${apiPort}`);

async function start() {
  const contentDir =
    process.env.WITCLASH_CONTENT_DIR ??
    join(process.cwd(), "../../games/wit-clash/content/categories");
  const categories = await CategoryRepository.loadFromDir(contentDir);
  console.info(`[Content] Loaded ${categories.all().length} categories from ${contentDir}`);
  if (categories.all().length < 3) {
    throw new Error(`Need at least 3 categories to run a vote; found ${categories.all().length}`);
  }

  const witClashPath = "../../../games/wit-clash/index.js";
  const { WitClashGame } = (await import(witClashPath)) as {
    WitClashGame: GameDefinition<unknown>;
  };

  class WitClashRoom extends GameRoom {
    constructor() {
      super(roomCodeService, categories);
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
