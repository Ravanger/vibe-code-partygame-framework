import { Server } from "colyseus";
import { createServer } from "http";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;
const gameServer = new Server({
  server: createServer(),
});

gameServer.define("game", GameRoom);
gameServer.listen(port);
console.log(`[GameServer] Listening on port ${port}`);
