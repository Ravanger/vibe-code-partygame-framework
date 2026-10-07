import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  freePort,
  type NodeServerHandle,
  ServerProbe,
  serveApi,
  startNodeServer,
} from "../src/node.js";
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

describe("serveApi", () => {
  it("answers /api/resolve-code over plain http", async () => {
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port, host: "127.0.0.1" }));
    const response = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`);
    expect(response.status).toBe(404);
    expect(await response.json()).toHaveProperty("error");
  });

  it("rejects when the port is taken", async () => {
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port, host: "127.0.0.1" }));
    await expect(serveApi(new RoomCodeService(), { port, host: "127.0.0.1" })).rejects.toThrow();
  });
});

describe("startNodeServer", () => {
  const probe = new ServerProbe();

  it("serves rooms and the code API on free ports, and stops twice without complaint", async () => {
    const handle = await start({ games: GAMES });
    expect(handle.endpoint).toBe(`ws://127.0.0.1:${handle.port}`);
    expect(handle.port).not.toBe(handle.apiPort);
    expect(await probe.isGameServer(handle.port, handle.apiPort)).toBe(true);
    await handle.stop();
    await handle.stop();
    expect(await probe.canConnect(handle.port)).toBe(false);
    expect(await probe.canConnect(handle.apiPort)).toBe(false);
  });

  it("uses the given ports and refuses taken ones", async () => {
    const first = await start({ games: GAMES });
    await expect(
      startNodeServer({ games: GAMES, port: first.port, apiPort: first.apiPort }),
    ).rejects.toThrow();

    const freeGamePort = await freePort();
    await expect(
      startNodeServer({ games: GAMES, port: freeGamePort, apiPort: first.apiPort }),
    ).rejects.toThrow();
    expect(await probe.canConnect(freeGamePort)).toBe(false);
  });

  it("binds the code API to the given interface", async () => {
    const handle = await start({ games: GAMES, host: "127.0.0.1" });
    expect(await probe.canConnect(handle.apiPort, "127.0.0.1")).toBe(true);
  });

  it("refuses one port for both servers", async () => {
    const port = await freePort();
    await expect(startNodeServer({ games: GAMES, port, apiPort: port })).rejects.toThrow(
      /different ports/,
    );
  });

  it("closes the code API again when the game server cannot be built", async () => {
    const apiPort = await freePort();
    class BrokenList extends Array<(typeof GAMES)[number]> {
      override [Symbol.iterator](): ArrayIterator<(typeof GAMES)[number]> {
        throw new Error("no games for you");
      }
    }
    let calls = 0;
    await expect(
      startNodeServer(
        { games: new BrokenList(), apiPort },
        {
          freePort: async () => {
            calls++;
            return await freePort();
          },
        },
      ),
    ).rejects.toThrow(/no games/);
    expect(calls).toBe(1); // the auto game port; a non-EADDRINUSE failure is never re-rolled
    expect(await probe.canConnect(apiPort)).toBe(false);
  });

  it("opens nothing when the game port is taken", async () => {
    const first = await start({ games: GAMES });
    const freeApiPort = await freePort();
    await expect(
      startNodeServer({ games: GAMES, port: first.port, apiPort: freeApiPort }),
    ).rejects.toThrow();
    expect(await probe.canConnect(freeApiPort)).toBe(false);
  });

  it("re-rolls a free port that got taken in the meantime", async () => {
    const first = await start({ games: GAMES });
    let calls = 0;
    const handle = await start(
      { games: GAMES },
      { freePort: async () => (calls++ === 0 ? first.port : await freePort()) },
    );
    expect(calls).toBe(4); // two ports per attempt, one failed attempt
    expect(await probe.isGameServer(handle.port, handle.apiPort)).toBe(true);
  });

  it("re-rolls when the code API port got taken after the game port was claimed", async () => {
    const first = await start({ games: GAMES });
    const gameFree = await freePort();
    const sequence = [gameFree, first.port, await freePort(), await freePort()];
    let n = 0;
    const next = async (): Promise<number> => {
      const port = sequence[n];
      n++;
      if (port === undefined) throw new Error("sequence exhausted");
      return port;
    };
    const handle = await start({ games: GAMES }, { freePort: next });
    expect(n).toBe(4);
    expect(await probe.canConnect(gameFree)).toBe(false); // the claimed game port was released
    expect(await probe.isGameServer(handle.port, handle.apiPort)).toBe(true);
  });

  it("gives up after five attempts when every discovered port is taken", async () => {
    const first = await start({ games: GAMES });
    let calls = 0;
    await expect(
      startNodeServer(
        { games: GAMES },
        {
          freePort: async () => {
            calls++;
            return first.port;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(calls).toBe(10); // five attempts, two ports each
  });

  it("does not re-roll explicitly given ports", async () => {
    const first = await start({ games: GAMES });
    const freeApiPort = await freePort();
    let calls = 0;
    await expect(
      startNodeServer(
        { games: GAMES, port: first.port, apiPort: freeApiPort },
        {
          freePort: async () => {
            calls++;
            return freeApiPort;
          },
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it("does not re-roll when an explicitly given API port is taken", async () => {
    const first = await start({ games: GAMES });
    let calls = 0;
    let gamePort = 0;
    await expect(
      startNodeServer(
        { games: GAMES, apiPort: first.port },
        {
          freePort: async () => {
            calls++;
            const port = await freePort();
            gamePort = port;
            return port;
          },
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1); // only the auto game port; no re-roll
    expect(await probe.canConnect(gamePort)).toBe(false); // nothing left open
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
