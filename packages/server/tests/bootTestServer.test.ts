import { WebSocketTransport } from "@colyseus/ws-transport";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameServer } from "../src/createGameServer.js";
import { listenGameServer } from "../src/gameTransport.js";
import { freePort } from "../src/probe.js";
import { BUZZER_PUBLIC_FIELDS, BuzzerGame, BuzzerState } from "./fixtures/buzzer.js";
import { bootBuzzer } from "./support.js";

const GAME = {
  roomName: "buzzer",
  definition: BuzzerGame,
  stateClass: BuzzerState,
  publicFields: BUZZER_PUBLIC_FIELDS,
};

describe("bootTestServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a second live server until the first is shut down", async () => {
    const first = await bootBuzzer();
    try {
      await expect(bootBuzzer()).rejects.toThrow(
        "bootTestServer: only one test server may be live per process; call shutdown() first",
      );
    } finally {
      await first.shutdown();
    }
    const second = await bootBuzzer();
    await second.shutdown();
  });

  it("prints no banner and adds no process signal listeners", async () => {
    const write = vi.spyOn(console, "log");
    const before = process.listenerCount("SIGINT");
    const t = await bootBuzzer();
    try {
      expect(process.listenerCount("SIGINT")).toBe(before);
      expect(write.mock.calls.some(([chunk]) => String(chunk).includes("Colyseus Cloud"))).toBe(
        false,
      );
    } finally {
      await t.shutdown();
    }
  });
});

describe("createGameServer process options", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("greets and registers signal handlers by default", async () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const before = process.listenerCount("SIGINT");
    const server = createGameServer({ games: [GAME] });
    try {
      expect(process.listenerCount("SIGINT")).toBe(before + 1);
      await listenGameServer(server, await freePort());
      expect(write.mock.calls.some(([chunk]) => String(chunk).includes("Colyseus Cloud"))).toBe(
        true,
      );
    } finally {
      await server.gracefullyShutdown(false);
    }
  });

  it("passes greet and gracefullyShutdown through, with a custom transport too", async () => {
    const before = process.listenerCount("SIGINT");
    for (const transport of [undefined, new WebSocketTransport()]) {
      const server = createGameServer({
        games: [GAME],
        greet: false,
        gracefullyShutdown: false,
        ...(transport ? { transport } : {}),
      });
      try {
        await listenGameServer(server, await freePort());
        expect(server.options).toMatchObject({ greet: false, gracefullyShutdown: false });
        expect(process.listenerCount("SIGINT")).toBe(before);
      } finally {
        await server.gracefullyShutdown(false);
      }
    }
  });
});
