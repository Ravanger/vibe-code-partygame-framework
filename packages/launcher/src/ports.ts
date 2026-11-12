import type { LaunchPorts } from "./types.js";

/** The default TCP ports: the game server, the code API, the Vite dev client and the production client. */
export const DEFAULT_PORTS: LaunchPorts = {
  game: 2567,
  api: 3001,
  clientDev: 5173,
  production: 3000,
};
