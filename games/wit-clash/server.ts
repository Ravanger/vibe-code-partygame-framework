import { startServer } from "@partygame/server/bun";
import { createWitClashGame } from "./src/game.js";
import { contentDir, loadContent } from "./src/loadContent.js";
import { ROOM_NAME } from "./src/roomName.js";
import { WitClashState } from "./src/state.js";

const categories = await loadContent(contentDir(process.env, import.meta.url));

await startServer({
  games: [
    {
      roomName: ROOM_NAME,
      definition: createWitClashGame({ categories }),
      stateClass: WitClashState,
    },
  ],
});
