import { startNodeServer } from "@partygame/server/node";
import { TAP_ROOM, TapGame, TapState } from "../tapGame.js";

await startNodeServer({
  port: Number(process.env.PORT),
  apiPort: Number(process.env.API_PORT),
  games: [{ roomName: TAP_ROOM, definition: TapGame, stateClass: TapState }],
});
