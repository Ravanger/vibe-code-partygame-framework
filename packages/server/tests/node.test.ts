import { createServer, request as httpRequest, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import type { LogFields, Logger } from "@partygame/core";
import { afterEach, describe, expect, it } from "vitest";
import { type NodeServerHandle, serveApi, startNodeServer } from "../src/node.js";
import { freePort, ServerProbe } from "../src/probe.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";
import { GAMES } from "./support.js";

/** The first external IPv4 address of this machine; binding tests skip their LAN half without one. */
const lanAddress = (): string | undefined =>
  Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .find((address) => address.family === "IPv4" && !address.internal)?.address;

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
  const handle = await startNodeServer(
    { greet: false, gracefullyShutdown: false, ...options },
    hooks,
  );
  handles.push(handle);
  return handle;
};

/** A raw request with an arbitrary method; node's client sends it as-is, where fetch would refuse. */
const rawRequest = (
  port: number,
  method: string,
  path: string,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const request = httpRequest({ host: "127.0.0.1", port, method, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    request.on("error", reject);
    request.end();
  });

const occupyLoopback = async (): Promise<number> => {
  const port = await freePort();
  const blocker = createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(port, "127.0.0.1", resolve);
  });
  servers.push(blocker);
  return port;
};

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

  it("binds loopback when no host is given", async () => {
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port }));
    expect(await new ServerProbe().canConnect(port, "127.0.0.1")).toBe(true);
    const lan = lanAddress();
    if (lan !== undefined) expect(await new ServerProbe().canConnect(port, lan)).toBe(false);
  });

  it("binds the given non-loopback interface and no other", async () => {
    const lan = lanAddress();
    if (lan === undefined) return;
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port, host: lan }));
    expect(await new ServerProbe().canConnect(port, lan)).toBe(true);
    expect(await new ServerProbe().canConnect(port, "127.0.0.1")).toBe(false);
  });

  it("forwards request headers so the handler sees Origin", async () => {
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port, host: "127.0.0.1" }));
    const response = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("passes the remote address as the second handler argument", async () => {
    const port = await freePort();
    const seen: Array<{ origin: string | null; remoteAddress?: string | undefined }> = [];
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        handler: (req, info) => {
          seen.push({ origin: req.headers.get("origin"), remoteAddress: info?.remoteAddress });
          return new Response(null, { status: 204 });
        },
      }),
    );
    await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ABCD`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(seen).toEqual([{ origin: "http://localhost:5173", remoteAddress: "127.0.0.1" }]);
  });

  it("applies allowedOrigins to the default handler", async () => {
    const port = await freePort();
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        allowedOrigins: ["http://party.example"],
      }),
    );
    const allowed = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`, {
      headers: { Origin: "http://party.example" },
    });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://party.example");
    const other = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`, {
      headers: { Origin: "http://elsewhere.example" },
    });
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("throttles /api/resolve-code per remote address with 429 and Retry-After", async () => {
    const port = await freePort();
    const codes = new RoomCodeService();
    codes.register("ABCD", "room-1");
    servers.push(
      await serveApi(codes, {
        port,
        host: "127.0.0.1",
        rateLimits: { resolveCode: { rate: 0, burst: 3 } },
      }),
    );
    const url = `http://127.0.0.1:${port}/api/resolve-code?code=ABCD`;
    for (let i = 0; i < 3; ++i) expect((await fetch(url)).status).toBe(200);
    const refused = await fetch(url);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "Too many requests" });
    expect(refused.headers.get("Retry-After")).toBe("1");
  });

  it("forwards multi-value headers such as Set-Cookie as separate values", async () => {
    const port = await freePort();
    const seen: string[][] = [];
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        handler: (req) => {
          seen.push(req.headers.getSetCookie());
          return new Response(null, { status: 204 });
        },
      }),
    );
    // fetch joins repeated header lines; a raw client sends one line per value
    await new Promise<void>((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: "/api/resolve-code?code=ABCD",
          headers: { "set-cookie": ["a=1", "b=2"] },
        },
        (res) => {
          res.resume();
          res.on("end", resolve);
        },
      );
      request.on("error", reject);
      request.end();
    });
    expect(seen).toEqual([["a=1", "b=2"]]);
  });

  it("refuses methods the Request constructor forbids and keeps serving", async () => {
    const port = await freePort();
    servers.push(await serveApi(new RoomCodeService(), { port, host: "127.0.0.1" }));
    const trace = await rawRequest(port, "TRACE", "/api/resolve-code");
    expect(trace.status).toBe(405);
    expect(JSON.parse(trace.body)).toEqual({ error: "Method not allowed" });
    // the server survived the unbuildable request
    const after = await fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`);
    expect(after.status).toBe(404);
  });

  it("answers a throwing handler with a fixed 500 body and keeps serving", async () => {
    const port = await freePort();
    let calls = 0;
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        handler: () => {
          ++calls;
          if (calls === 1) throw new Error("secret internals");
          return new Response(null, { status: 204 });
        },
      }),
    );
    const url = `http://127.0.0.1:${port}/api/resolve-code?code=ABCD`;
    const boom = await fetch(url);
    expect(boom.status).toBe(500);
    const text = await boom.text();
    expect(JSON.parse(text)).toEqual({ error: "Internal server error" });
    expect(text).not.toContain("secret internals");
    // the server survived the handler failure
    expect((await fetch(url)).status).toBe(204);
  });

  it("answers a response whose body fails to read with a fixed 500 body and keeps serving", async () => {
    const port = await freePort();
    let calls = 0;
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        handler: () => {
          ++calls;
          if (calls === 1) {
            // A body that rejects when read: response.text() throws after the headers are known.
            return new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.error(new Error("body failed"));
                },
              }),
            );
          }
          return new Response(null, { status: 204 });
        },
      }),
    );
    const url = `http://127.0.0.1:${port}/api/resolve-code?code=ABCD`;
    const boom = await fetch(url);
    expect(boom.status).toBe(500);
    const text = await boom.text();
    expect(JSON.parse(text)).toEqual({ error: "Internal server error" });
    expect(text).not.toContain("body failed");
    // the server survived the unreadable body
    expect((await fetch(url)).status).toBe(204);
  });

  it("keys the resolve-code throttle on X-Forwarded-For when trustProxy is on", async () => {
    const port = await freePort();
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        trustProxy: true,
        rateLimits: { resolveCode: { rate: 0, burst: 1 } },
      }),
    );
    const ask = (xff: string) =>
      fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`, {
        headers: { "X-Forwarded-For": xff },
      });
    expect((await ask("203.0.113.7")).status).toBe(404); // A's one token is spent (unknown code)
    expect((await ask("203.0.113.8")).status).toBe(404); // B behind the same proxy: its own bucket
    expect((await ask("203.0.113.7")).status).toBe(429); // A's bucket is spent
  });

  it("ignores X-Forwarded-For when trustProxy is off", async () => {
    const port = await freePort();
    servers.push(
      await serveApi(new RoomCodeService(), {
        port,
        host: "127.0.0.1",
        rateLimits: { resolveCode: { rate: 0, burst: 1 } },
      }),
    );
    const ask = (xff: string) =>
      fetch(`http://127.0.0.1:${port}/api/resolve-code?code=ZZZZ`, {
        headers: { "X-Forwarded-For": xff },
      });
    expect((await ask("203.0.113.7")).status).toBe(404);
    // the spoofed header changes nothing: one socket, one bucket
    expect((await ask("203.0.113.8")).status).toBe(429);
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
      startNodeServer({
        greet: false,
        gracefullyShutdown: false,
        games: GAMES,
        port: first.port,
        apiPort: first.apiPort,
      }),
    ).rejects.toThrow();

    const freeGamePort = await freePort();
    await expect(
      startNodeServer({
        greet: false,
        gracefullyShutdown: false,
        games: GAMES,
        port: freeGamePort,
        apiPort: first.apiPort,
      }),
    ).rejects.toThrow();
    expect(await probe.canConnect(freeGamePort)).toBe(false);
  });

  it("binds the code API to the given interface", async () => {
    const handle = await start({ games: GAMES, host: "127.0.0.1" });
    expect(await probe.canConnect(handle.apiPort, "127.0.0.1")).toBe(true);
  });

  it("binds the code API to loopback by default", async () => {
    const handle = await start({ games: GAMES });
    expect(await probe.canConnect(handle.apiPort, "127.0.0.1")).toBe(true);
    const lan = lanAddress();
    if (lan !== undefined) expect(await probe.canConnect(handle.apiPort, lan)).toBe(false);
  });

  it("reads HOST and ALLOWED_ORIGINS from the environment", async () => {
    const lan = lanAddress();
    if (lan === undefined) return;
    process.env.HOST = lan;
    process.env.ALLOWED_ORIGINS = "*";
    try {
      const handle = await start({ games: GAMES });
      expect(await probe.canConnect(handle.apiPort, lan)).toBe(true);
      expect(await probe.canConnect(handle.apiPort, "127.0.0.1")).toBe(false);
      const response = await fetch(`http://${lan}:${handle.apiPort}/api/resolve-code?code=ABCD`, {
        headers: { Origin: "http://party.example" },
      });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    } finally {
      delete process.env.HOST;
      delete process.env.ALLOWED_ORIGINS;
    }
  });

  it("throttles /api/resolve-code with the given rate limits", async () => {
    const handle = await start({
      games: GAMES,
      host: "127.0.0.1",
      rateLimits: { resolveCode: { rate: 0, burst: 1 } },
    });
    const url = `http://127.0.0.1:${handle.apiPort}/api/resolve-code?code=ABCD`;
    expect((await fetch(url)).status).toBe(404); // the bucket allows one request
    const refused = await fetch(url);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("1");
  });

  it("keys the code API throttle on X-Forwarded-For and routes limit hits to the configured logger", async () => {
    const lines: Array<{ event: string; fields?: LogFields | undefined }> = [];
    const logger: Logger = {
      info: () => {},
      warn: (event, fields) => {
        lines.push({ event, fields });
      },
      error: () => {},
    };
    const handle = await start({
      games: GAMES,
      host: "127.0.0.1",
      trustProxy: true,
      rateLimits: { resolveCode: { rate: 0, burst: 1 }, mode: "observe" },
      logger,
    });
    const ask = (xff: string) =>
      fetch(`http://127.0.0.1:${handle.apiPort}/api/resolve-code?code=ZZZZ`, {
        headers: { "X-Forwarded-For": xff },
      });
    expect((await ask("203.0.113.7")).status).toBe(404); // A spends its one token (unknown code)
    expect((await ask("203.0.113.8")).status).toBe(404); // B behind the same proxy: its own bucket
    const observed = await ask("203.0.113.7"); // A is over its limit, but observe mode only reports
    expect(observed.status).toBe(404);
    const hits = lines.filter((line) => line.event === "rate.limit");
    expect(hits.map((line) => line.fields?.key)).toEqual(["203.0.113.7"]); // keyed by the proxy hop, not the socket
  });

  it("refuses one port for both servers", async () => {
    const port = await freePort();
    await expect(
      startNodeServer({
        greet: false,
        gracefullyShutdown: false,
        games: GAMES,
        port,
        apiPort: port,
      }),
    ).rejects.toThrow(/different ports/);
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
        { greet: false, gracefullyShutdown: false, games: new BrokenList(), apiPort },
        {
          freePort: async () => {
            ++calls;
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
      startNodeServer({
        greet: false,
        gracefullyShutdown: false,
        games: GAMES,
        port: first.port,
        apiPort: freeApiPort,
      }),
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
    const taken = await occupyLoopback();
    const gameFree = await freePort();
    const sequence = [gameFree, taken, await freePort(), await freePort()];
    let n = 0;
    const next = async (): Promise<number> => {
      const port = sequence[n];
      ++n;
      if (port === undefined) throw new Error("sequence exhausted");
      return port;
    };
    const handle = await start(
      { games: GAMES, greet: false, gracefullyShutdown: false },
      { freePort: next },
    );
    expect(n).toBe(4);
    expect(await probe.canConnect(gameFree)).toBe(false); // the claimed game port was released
    expect(await probe.isGameServer(handle.port, handle.apiPort)).toBe(true);
  });

  it("gives up after five attempts when every discovered port is taken", async () => {
    const first = await start({ games: GAMES });
    let calls = 0;
    await expect(
      startNodeServer(
        { greet: false, gracefullyShutdown: false, games: GAMES },
        {
          freePort: async () => {
            ++calls;
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
        {
          greet: false,
          gracefullyShutdown: false,
          games: GAMES,
          port: first.port,
          apiPort: freeApiPort,
        },
        {
          freePort: async () => {
            ++calls;
            return freeApiPort;
          },
        },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it("does not re-roll when an explicitly given API port is taken", async () => {
    const taken = await occupyLoopback();
    let calls = 0;
    let gamePort = 0;
    await expect(
      startNodeServer(
        { greet: false, gracefullyShutdown: false, games: GAMES, apiPort: taken },
        {
          freePort: async () => {
            ++calls;
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
