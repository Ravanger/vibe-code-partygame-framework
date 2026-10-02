import { startServer } from "@partygame/server/bun";
import { witClashGame } from "./src/hostedGame.js";
import { contentDir, loadContent } from "./src/loadContent.js";

const categories = await loadContent(contentDir(process.env, import.meta.url));

await startServer({ games: [witClashGame(categories)] });
