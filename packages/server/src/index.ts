import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";
import { WitClashGame } from "../../../games/wit-clash/index.js";

const port = Number(process.env.PORT) || 2567;
const server = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: server as any,
  }),
});

class WitClashRoom extends GameRoom {
  onCreate() {
    this.setDefinition(WitClashGame);
    super.onCreate();
  }
}

gameServer.define("wit_clash", WitClashRoom);
gameServer.listen(port);
console.info(`[GameServer] Listening on port ${port}`);
