import { BunWebSockets } from "@colyseus/bun-websockets";
// @ts-expect-error - Bun ships no TypeScript declarations in this repo
import { serve } from "bun";
import { createApiHandler } from "./api/createApiHandler.js";
import { createGameServer, type GameServerOptions } from "./createGameServer.js";
import { resolveStartOptions, type StartPorts } from "./resolveStartOptions.js";

export type StartServerOptions = Omit<GameServerOptions, "transport"> & StartPorts;

/** Bun entry point: WebSocket game server plus the code-resolution API. */
export async function startServer(options: StartServerOptions) {
  const { port, apiPort, roomCodeService } = resolveStartOptions(options, process.env);
  const server = createGameServer({
    ...options,
    roomCodeService,
    transport: new BunWebSockets({ path: "/" }),
  });
  const api = serve({ port: apiPort, fetch: createApiHandler(roomCodeService) });
  await server.listen(port);
  return { server, api };
}
