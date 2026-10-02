import { waitFor } from "@partygame/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GameClient } from "../../terminal/GameClient.js";
import { GameServerHandle } from "../../terminal/GameServerHandle.js";
import { ServerProbe } from "../../terminal/ServerProbe.js";
import { makeCategories } from "../game/support.js";

const handle = new GameServerHandle(makeCategories());
const probe = new ServerProbe();
let client: GameClient;

beforeAll(async () => {
  await handle.start();
  client = new GameClient(handle.endpoint, handle.apiPort);
});
afterAll(() => handle.stop());

describe("GameServerHandle and ServerProbe", () => {
  it("serves a room on free ports that the probe recognises", async () => {
    expect(handle.endpoint).toBe(`ws://127.0.0.1:${handle.port}`);
    expect(await probe.isGameServer(handle.port, handle.apiPort)).toBe(true);
    expect(
      await probe.answers(`http://localhost:${handle.apiPort}/api/resolve-code?code=ZZZZ`),
    ).toBe(true);
  });

  it("does not take a silent port for a game server", async () => {
    expect(await probe.isGameServer(handle.port, 1)).toBe(false);
    expect(await probe.isGameServer(1, handle.apiPort)).toBe(false);
    expect(await probe.answers("http://localhost:1/")).toBe(false);
  });

  it("refuses to start on ports that are taken, and stays stoppable", async () => {
    const second = new GameServerHandle(makeCategories(), {
      port: handle.port,
      apiPort: handle.apiPort,
    });
    await expect(second.start()).rejects.toThrow();
    await second.stop();
  });
});

describe("GameClient", () => {
  it("creates a named room, lets others join and watch it, and refuses a taken name", async () => {
    const host = await client.create(crypto.randomUUID(), "Ann");
    const code = host.state.roomCode;
    expect(host.state.players.size).toBe(1);

    const guest = await client.join(code, crypto.randomUUID(), "Bob");
    expect(guest.state.players.size).toBe(2);
    await expect(client.join(code, crypto.randomUUID(), "bob")).rejects.toThrow();

    const watcher = await client.watch(code, crypto.randomUUID());
    await waitFor(() => watcher.state.spectatorCount === 1, "the spectator", 2000);
    for (const room of [watcher, guest, host]) await room.leave(true);
  });

  it("passes room options on creation", async () => {
    const host = await client.create(crypto.randomUUID(), "Ann", { totalRounds: 2 });
    expect(JSON.parse(host.state.options).totalRounds).toBe(2);
    await host.leave(true);
  });

  it("says when a code does not exist", async () => {
    await expect(client.watch("QQQQ", crypto.randomUUID())).rejects.toThrow();
  });
});
