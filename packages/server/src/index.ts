import { createServer } from "node:http";
import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;
const gameServer = new Server({
  server: createServer(),
});

gameServer.define("game", GameRoom);
gameServer.listen(port);
console.info(`[GameServer] Listening on port ${port}`);
