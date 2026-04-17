import { BunWebSockets } from "@colyseus/bun-websockets";
import type { GameDefinition } from "@partygame/core";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;

const gameServer = new Server({
  transport: new BunWebSockets({ path: "/" }),
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
