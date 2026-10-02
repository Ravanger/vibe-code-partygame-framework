import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createSocketServer } from "node:net";
import { z } from "zod";
import { createApiHandler } from "./api/createApiHandler.js";
import type { RoomCodeService } from "./services/RoomCodeService.js";

const AddressSchema = z.object({ port: z.number() });

/** A TCP port that was free a moment ago on 127.0.0.1. */
export async function freePort(): Promise<number> {
  const probe = createSocketServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = AddressSchema.parse(probe.address());
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

export interface ServeApiOptions {
  port: number;
  /** Interface to bind; every interface when omitted. */
  host?: string;
}

/** Serves `/api/resolve-code` for `codes` on Node's `http` (the Bun entry has its own). Close the returned server to stop it. */
export async function serveApi(
  codes: RoomCodeService,
  options: ServeApiOptions,
): Promise<HttpServer> {
  const handler = createApiHandler(codes);
  const api = createHttpServer(async (req, res) => {
    const response = handler(new Request(`http://127.0.0.1${req.url}`));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  });
  await new Promise<void>((resolve, reject) => {
    api.once("error", reject);
    api.listen(options.port, options.host, resolve);
  });
  return api;
}
