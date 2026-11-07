import { Client } from "@colyseus/sdk";
import { waitFor } from "@partygame/client-utils";
import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { CLOSE_CODES, ClientMessage, PROTOCOL_VERSION, ServerMessage } from "@partygame/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GameClient } from "../src/GameClient.js";
import { TAP_PUBLIC_FIELDS, TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

let handle: NodeServerHandle;
let client: GameClient<TapState>;

beforeAll(async () => {
  handle = await startNodeServer({
    greet: false,
    gracefullyShutdown: false,
    games: [
      {
        roomName: TAP_ROOM,
        definition: TapGame,
        stateClass: TapState,
        publicFields: TAP_PUBLIC_FIELDS,
      },
    ],
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

  it("waits for the initial state sync when joining", async () => {
    // The SDK resolves joinById before the first state sync; room.state is undefined until it lands.
    const host = await client.create(crypto.randomUUID(), "Ann");
    const code = host.state.roomCode;
    const state = new TapState();
    let synced = false;
    setTimeout(() => {
      state.roomCode = code;
      synced = true;
    }, 30);
    const fakeRoom = {
      get state() {
        return synced ? state : undefined;
      },
      leave: async () => 0,
    };
    const spy = vi.spyOn(Client.prototype, "joinById");
    try {
      spy.mockImplementation(async () => fakeRoom as never);
      const watcher = await client.watch(code, crypto.randomUUID());
      expect(watcher.state.roomCode).toBe(code);
    } finally {
      spy.mockRestore();
      await host.leave(true);
    }
  });

  it("leaves the room it created when claiming the name fails", async () => {
    const state = new TapState();
    state.roomCode = "WXYZ";
    const errorCallbacks: Array<(payload: unknown) => void> = [];
    const leaveCalls: Array<boolean | undefined> = [];
    const fakeRoom = {
      get state() {
        return state;
      },
      onMessage(type: string, callback: (payload: unknown) => void): () => void {
        if (type === ServerMessage.ERROR) errorCallbacks.push(callback);
        return () => undefined;
      },
      send(type: string): void {
        if (type !== ClientMessage.SET_NAME) return;
        for (const callback of errorCallbacks)
          callback({ code: "NOT_ALLOWED", message: "Name taken" });
      },
      leave(reconnect?: boolean): Promise<number> {
        leaveCalls.push(reconnect);
        return Promise.resolve(0);
      },
    };
    const createSpy = vi.spyOn(Client.prototype, "create");
    try {
      createSpy.mockImplementation(async () => fakeRoom as never);
      await expect(client.create(crypto.randomUUID(), "Ann")).rejects.toThrow("Name taken");
      expect(leaveCalls).toEqual([true]);
    } finally {
      createSpy.mockRestore();
    }
  });

  it("lets a playerId passed in room options win over the explicit argument", async () => {
    const createSpy = vi.spyOn(Client.prototype, "create");
    try {
      createSpy.mockRejectedValue(new Error("stop"));
      await expect(client.create("explicit-id", "Ann", { playerId: "options-id" })).rejects.toThrow(
        "stop",
      );
      expect(createSpy.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ playerId: "options-id" }),
      );
    } finally {
      createSpy.mockRestore();
    }
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

  it("sends a fresh seat secret on every join", async () => {
    const host = await client.create(crypto.randomUUID(), "Ann");
    const joinSpy = vi.spyOn(Client.prototype, "joinById");
    try {
      const bob = await client.join(host.state.roomCode, crypto.randomUUID(), "Bob");
      expect(joinSpy).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ seatSecret: expect.stringMatching(/^[0-9a-f-]{72}$/) }),
        TapState,
      );
      const bobSecret = joinSpy.mock.calls.at(-1)?.[1].seatSecret;
      const carol = await client.join(host.state.roomCode, crypto.randomUUID(), "Carol");
      expect(joinSpy).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ seatSecret: expect.stringMatching(/^[0-9a-f-]{72}$/) }),
        TapState,
      );
      expect(joinSpy.mock.calls.at(-1)?.[1].seatSecret).not.toBe(bobSecret);
      await bob.leave(true);
      await carol.leave(true);
    } finally {
      joinSpy.mockRestore();
      await host.leave(true);
    }
  });
});
