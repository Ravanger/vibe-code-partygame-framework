import { Client } from "@colyseus/sdk";
import { waitFor } from "@partygame/client-utils";
import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { CLOSE_CODES, PROTOCOL_VERSION } from "@partygame/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";
import { TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

let handle: NodeServerHandle;
let client: GameClient<TapState>;

beforeAll(async () => {
  handle = await startNodeServer({
    games: [{ roomName: TAP_ROOM, definition: TapGame, stateClass: TapState }],
  });
  client = new GameClient(handle.endpoint, handle.apiPort, {
    roomName: TAP_ROOM,
    stateClass: TapState,
  });
});
afterAll(() => handle.stop());

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
    const hostId = crypto.randomUUID();
    const host = await client.create(hostId, "Ann", { seats: [hostId] });
    await expect(client.join(host.state.roomCode, crypto.randomUUID(), "Zed")).rejects.toThrow(
      CLOSE_CODES.WATCH_ONLY.message,
    );
    await host.leave(true);
  });

  it("says when a code does not exist", async () => {
    await expect(client.watch("QQQQ", crypto.randomUUID())).rejects.toThrow();
  });

  it("sends the current protocol version when creating and joining", async () => {
    const createSpy = vi.spyOn(Client.prototype, "create");
    const joinSpy = vi.spyOn(Client.prototype, "joinById");
    try {
      const host = await client.create(crypto.randomUUID(), "Ver");
      expect(createSpy.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      );
      await client.join(host.state.roomCode, crypto.randomUUID(), "Vic");
      expect(joinSpy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({ protocolVersion: PROTOCOL_VERSION }),
      );
    } finally {
      createSpy.mockRestore();
      joinSpy.mockRestore();
    }
  });
});
