import { fileURLToPath } from "node:url";
import { serve } from "@partygame/game-kit";
import { gamePackage } from "./gamePackage.js";

await serve(gamePackage, { gameDir: fileURLToPath(new URL(".", import.meta.url)) });
