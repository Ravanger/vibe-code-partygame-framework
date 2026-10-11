import type { Server as HttpServer } from "node:http";
import { connect, createServer as createSocketServer } from "node:net";
import { ResolveCodeResponseSchema } from "@partygame/shared";
import { z } from "zod";

const AddressSchema = z.object({ port: z.number() });

/** A TCP port that was free a moment ago on 127.0.0.1. */
export async function freePort(): Promise<number> {
  const probe = createSocketServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = AddressSchema.parse(probe.address());
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/** Closes an HTTP server, resolving when it already stopped: after `closeAllConnections()`, Bun reports `ERR_SERVER_NOT_RUNNING` to the close callback where Node resolves cleanly. Any other close error is propagated. */
export function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (error === undefined || code === "ERR_SERVER_NOT_RUNNING") resolve();
      else reject(error);
    });
  });
}

const PROBE_TIMEOUT_MS = 800;

/** Checks whether something is already running where a launcher would look. */
export class ServerProbe {
  /** True when a game server listens on `port` and its code API answers on `apiPort`. */
  async isGameServer(port: number, apiPort: number): Promise<boolean> {
    if (!(await this.canConnect(port))) return false;
    try {
      const response = await fetch(`http://localhost:${apiPort}/api/resolve-code?code=ZZZZ`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return ResolveCodeResponseSchema.safeParse(await response.json()).success;
    } catch {
      return false;
    }
  }

  /** True when `url` answers at all, whatever the status. */
  async answers(url: string): Promise<boolean> {
    try {
      await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return true;
    } catch {
      return false;
    }
  }

  /** True when something accepts a TCP connection on `port`. */
  canConnect(port: number, host = "localhost"): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ port, host });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
  }
}
