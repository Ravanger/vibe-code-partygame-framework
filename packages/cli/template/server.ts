import { startServer } from "@partygame/server/bun";
import { __camelName__Game } from "./src/hostedGame.js";

await startServer({ games: [__camelName__Game()] });
