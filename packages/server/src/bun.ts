import { BunWebSockets } from "@colyseus/bun-websockets";
// @ts-expect-error - Bun ships no TypeScript declarations in this repo
import { serve } from "bun";
import { createApiHandler } from "./api/createApiHandler.js";
import {
  createGameServer,
  createResolveCodeThrottle,
  DEFAULT_MAX_PAYLOAD_BYTES,
  type GameServerOptions,
} from "./createGameServer.js";
import { resolveStartOptions, type StartPorts } from "./resolveStartOptions.js";

export type StartServerOptions = Omit<GameServerOptions, "transport"> & StartPorts;

/** Bun entry point: WebSocket game server plus the code-resolution API. */
export async function startServer(options: StartServerOptions) {
  const { port, apiPort, roomCodeService, host, allowedOrigins, trustProxy } = resolveStartOptions(
    options,
    process.env,
  );
  const server = createGameServer({
    ...options,
    roomCodeService,
    transport: new BunWebSockets({
      path: "/",
      maxPayloadLength: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
    }),
  });
  const { limiter, bucket } = createResolveCodeThrottle(options.rateLimits, options.logger);
  const handler = createApiHandler(roomCodeService, {
    ...(allowedOrigins !== undefined ? { allowedOrigins } : {}),
    ...(trustProxy !== undefined ? { trustProxy } : {}),
    limiter,
    resolveCode: bucket,
  });
  let api: ReturnType<typeof serve>;
  api = serve({
    port: apiPort,
    hostname: host ?? "127.0.0.1",
    fetch: (req: Request) => {
      const remoteAddress = api?.requestIP(req)?.address;
      return handler(req, remoteAddress === undefined ? {} : { remoteAddress });
    },
  });
  try {
    await server.listen(port);
  } catch (error) {
    // A failed game-server bind must not leave the code API listening.
    api.stop();
    throw error;
  }
  return { server, api };
}
