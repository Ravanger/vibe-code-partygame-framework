import { createServer } from "node:http";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { GameDefinition } from "@partygame/core";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;
const server = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

async function start() {
  const witClashPath = "../../../games/wit-clash/index.js";
  const { WitClashGame } = (await import(witClashPath)) as {
    WitClashGame: GameDefinition<unknown>;
  };

  class WitClashRoom extends GameRoom {
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
