import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { waitFor } from "@partygame/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
      "watch-only",
    );
    await host.leave(true);
  });

  it("says when a code does not exist", async () => {
    await expect(client.watch("QQQQ", crypto.randomUUID())).rejects.toThrow();
  });
});
