import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { freePort, serveApi } from "../src/node.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

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
