import { Agent, createServer, get, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type NodeServerHandle, serveApi, startNodeServer } from "../src/node.js";
import { closeHttpServer, freePort, ServerProbe } from "../src/probe.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import { GAMES } from "./support.js";

const servers: Server[] = [];
const handles: NodeServerHandle[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
  await Promise.all(handles.splice(0).map((h) => h.stop()));
});

const start = async (
  options: Parameters<typeof startNodeServer>[0],
  hooks?: Parameters<typeof startNodeServer>[1],
): Promise<NodeServerHandle> => {
  const handle = await startNodeServer(options, hooks);
  handles.push(handle);
  return handle;
};

const portOf = (server: Server): number => {
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("not listening");
  return address.port;
};

describe("freePort", () => {
  it("returns a port that can then be listened on", async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    servers.push(await serveApi(new RoomCodeService(), { port, host: "127.0.0.1" }));
  });
});

describe("closeHttpServer", () => {
  it("resolves when the server closes cleanly", async () => {
    const idle = createServer();
    await new Promise<void>((resolve) => idle.listen(0, "127.0.0.1", resolve));
    servers.push(idle);
    await expect(closeHttpServer(idle)).resolves.toBeUndefined();
  });

  it("resolves when a keep-alive connection was destroyed just before close", async () => {
    // On Bun this makes close() report ERR_SERVER_NOT_RUNNING to its callback; on Node it resolves cleanly.
    const busy = createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => busy.listen(0, "127.0.0.1", resolve));
    servers.push(busy);
    const agent = new Agent({ keepAlive: true });
    await new Promise<void>((resolve, reject) => {
      const request = get({ host: "127.0.0.1", port: portOf(busy), path: "/", agent }, (res) => {
        res.resume();
        res.on("end", () => resolve());
      });
      request.on("error", reject);
    });
    busy.closeAllConnections();
    await expect(closeHttpServer(busy)).resolves.toBeUndefined();
    agent.destroy();
  });

  it("propagates an unexpected close error", async () => {
    const idle = createServer();
    const boom = Object.assign(new Error("boom"), { code: "BOOM" });
    vi.spyOn(idle, "close").mockImplementation((callback) => {
      callback?.(boom);
      return idle;
    });
    await expect(closeHttpServer(idle)).rejects.toBe(boom);
  });
});

describe("ServerProbe", () => {
  const probe = new ServerProbe();

  it("does not take a silent port for a game server", async () => {
    const handle = await start({ games: GAMES });
    expect(await probe.isGameServer(handle.port, 1)).toBe(false);
    expect(await probe.isGameServer(1, handle.apiPort)).toBe(false);
    expect(await probe.answers("http://127.0.0.1:1/")).toBe(false);
    expect(await probe.canConnect(1)).toBe(false);
  });

  it("does not take a server that answers something else for a game server", async () => {
    const other = createServer((_req, res) => res.end("{}"));
    await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
    servers.push(other);
    const handle = await start({ games: GAMES });
    expect(await probe.answers(`http://127.0.0.1:${portOf(other)}/`)).toBe(true);
    expect(await probe.isGameServer(handle.port, portOf(other))).toBe(false);
  });

  it("recognises a running server and checks a host name", async () => {
    const handle = await start({ games: GAMES });
    expect(await probe.canConnect(handle.port, "127.0.0.1")).toBe(true);
    expect(
      await probe.answers(`http://127.0.0.1:${handle.apiPort}/api/resolve-code?code=ZZZZ`),
    ).toBe(true);
  });
});
