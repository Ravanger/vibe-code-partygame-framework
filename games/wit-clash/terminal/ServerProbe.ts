import { connect } from "node:net";
import { ResolveCodeResponseSchema } from "@partygame/shared";

const PROBE_TIMEOUT_MS = 800;

/** Checks whether something is already running where the terminal tools would look. */
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

  async answers(url: string): Promise<boolean> {
    try {
      await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return true;
    } catch {
      return false;
    }
  }

  private canConnect(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ port, host: "localhost" });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
  }
}
