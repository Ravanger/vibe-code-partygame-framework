import { createServer as createHttpServer } from "node:http";
import { Transport } from "@colyseus/core";
import { describe, expect, it } from "vitest";
import { GameColyseusServer, listenGameServer } from "../src/gameTransport.js";
import { freePort } from "../src/probe.js";

/** A transport that exposes no HTTP server. */
class NoHttpServerTransport extends Transport {
  override listen(): this {
    return this;
  }
  override shutdown(): void {}
  override simulateLatency(): void {}
}

describe("listenGameServer", () => {
  it("rejects when the transport has no HTTP server to race the bind against", async () => {
    const server = new GameColyseusServer({ transport: new NoHttpServerTransport() });
    await expect(listenGameServer(server, await freePort())).rejects.toThrow(/HTTP server/);
  });

  it("rejects when Colyseus' own listen rejects before the bind", async () => {
    const server = new GameColyseusServer({
      beforeListen: () => {
        throw new Error("no boot for you");
      },
    });
    await expect(listenGameServer(server, await freePort())).rejects.toThrow(/no boot/);
  });

  it("rejects with EADDRINUSE when the port was taken after discovery, instead of hanging", async () => {
    const port = await freePort();
    // Occupy the port the way a parallel test worker would.
    const blocker = createHttpServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(port, "127.0.0.1", resolve);
    });
    const server = new GameColyseusServer();
    try {
      await expect(listenGameServer(server, port)).rejects.toMatchObject({ code: "EADDRINUSE" });
    } finally {
      blocker.closeAllConnections();
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});
