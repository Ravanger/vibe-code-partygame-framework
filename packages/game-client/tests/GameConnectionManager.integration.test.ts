import { CloseCode } from "@colyseus/sdk";
import { bootTestServer, type TestServer, waitUntil } from "@partygame/server/testing";
import { ErrorCode } from "@partygame/shared";
import { flushSync } from "svelte";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GameConnectionManager } from "../src/GameConnectionManager.svelte.js";
import { GAMES, PressState, ROOM } from "./fixtures/pressGame.js";
import { observe } from "./observe.svelte.js";

let t: TestServer;
let apiPort: number;
let prefixes = 0;
const managers: GameConnectionManager<PressState>[] = [];

beforeAll(async () => {
  t = await bootTestServer({ games: GAMES, reconnectMs: 2000 });
  apiPort = await t.serveApi();
});
afterEach(async () => {
  for (const manager of managers.splice(0)) manager.dispose();
  await t.cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
afterAll(() => t.shutdown());

function newManager(prefix = `client${++prefixes}`): GameConnectionManager<PressState> {
  const manager = new GameConnectionManager<PressState>({
    endpoint: t.endpoint,
    roomName: ROOM,
    apiPort,
    storagePrefix: prefix,
    rootSchema: PressState,
  });
  managers.push(manager);
  return manager;
}

async function startedTable() {
  const host = newManager();
  await host.create();
  const guest = newManager();
  await guest.join(host.roomCode as string);
  host.setName("Host");
  guest.setName("Guest");
  await waitUntil(() => host.state?.phase === "Play" && guest.state?.phase === "Play", "started");
  return { host, guest };
}

describe("creating and joining", () => {
  it("creates a room as the host and lets a guest join by code", async () => {
    const host = newManager();
    const connecting = observe(() => host.status);
    await host.create();
    expect(host.status).toBe("connected");
    await waitUntil(() => host.roomCode !== undefined, "state with a room code");
    expect(host.roomCode).toMatch(/^[A-Z]{4}$/);
    expect(host.isHost).toBe(true);
    expect(host.me()?.id).toBe(host.playerId);
    flushSync();
    expect(connecting.values).toContain("connecting");
    connecting.stop();

    const guest = newManager();
    await guest.join(` ${(host.roomCode as string).toLowerCase()} `);
    await waitUntil(() => host.state?.players.size === 2, "two seats");
    expect(guest.isHost).toBe(false);
    expect(guest.me()?.name).toBe("");
    guest.setName("Guest");
    await waitUntil(() => host.state?.players.get(guest.playerId)?.name === "Guest", "named");
  });

  it("shows other clients' changes reactively", async () => {
    const { host, guest } = await startedTable();
    const presses = observe(() => guest.state?.presses);
    expect(await host.sendAction("PRESS", { times: 2 })).toEqual({ ok: true });
    await waitUntil(() => guest.state?.presses === 2, "press synced");
    flushSync();
    expect(presses.values.at(-1)).toBe(2);
    presses.stop();
  });

  it("rejects an unknown code with the server's reason and stays disconnected", async () => {
    const manager = newManager();
    await expect(manager.join("ZZZZ")).rejects.toThrow("Game code not found");
    expect(manager.status).toBe("disconnected");
    expect(manager.state).toBeUndefined();
  });

  it("rejects a reply it cannot read", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ surprise: true }));
    const manager = newManager();
    await expect(manager.join("ABCD")).rejects.toThrow("Unexpected reply");
  });

  it("does not open two connections for a double-tapped join", async () => {
    const host = newManager();
    await host.create();
    await waitUntil(() => host.roomCode !== undefined, "code");
    const guest = newManager();
    const code = host.roomCode as string;
    await Promise.all([guest.join(code), guest.join(code)]);
    await waitUntil(() => host.state?.players.size === 2, "seated");
    expect(host.state?.players.size).toBe(2);
  });

  it("treats watching and playing the same room as different joins", async () => {
    const host = newManager();
    await host.create();
    await waitUntil(() => host.roomCode !== undefined, "code");
    const code = host.roomCode as string;
    const guest = newManager();
    await guest.join(code);
    await waitUntil(() => host.state?.players.size === 2, "seated");
    await guest.joinAsSpectator(code);
    await waitUntil(() => host.state?.spectatorCount === 1, "watching");
    expect(guest.isSpectator).toBe(true);
    await waitUntil(() => host.state?.players.size === 1, "seat released");
    await guest.join(code);
    await waitUntil(() => host.state?.players.size === 2, "seated again");
    expect(guest.isSpectator).toBe(false);
    expect(localStorage.getItem(`client${prefixes}.spectator`)).toBeNull();
  });

  it("moves to another room when asked to join a different one", async () => {
    const first = newManager();
    await first.create();
    const second = newManager();
    await second.create();
    await waitUntil(() => second.roomCode !== undefined && first.roomCode !== undefined, "codes");
    const guest = newManager();
    await guest.join(first.roomCode as string);
    await guest.join(second.roomCode as string);
    await waitUntil(() => guest.roomCode === second.roomCode, "now in the second room");
    await waitUntil(() => first.state?.players.size === 1, "left the first");
  });

  it("watches a room as a spectator without taking a seat", async () => {
    const host = newManager();
    await host.create();
    await waitUntil(() => host.roomCode !== undefined, "code");
    const tv = newManager();
    await tv.joinAsSpectator(host.roomCode as string);
    await waitUntil(() => host.state?.spectatorCount === 1, "spectator counted");
    expect(tv.me()).toBeUndefined();
    expect(tv.state?.players.size).toBe(1);
    const result = await tv.sendAction("PRESS");
    expect(result.ok).toBe(false);
  });
});

describe("actions", () => {
  it("resolves with the server's verdict and keeps failures for the UI", async () => {
    const { host, guest } = await startedTable();
    const unknown = await host.sendAction("DANCE");
    expect(unknown).toMatchObject({ ok: false, error: { code: ErrorCode.UNKNOWN_ACTION } });
    await waitUntil(() => host.lastServerError?.code === ErrorCode.UNKNOWN_ACTION, "recorded");
    host.dismissError();
    await host.sendAction("PRESS", { times: 3 });
    const worn = await guest.sendAction("PRESS");
    expect(worn).toMatchObject({ ok: false, error: { code: ErrorCode.NOT_ALLOWED } });
    expect(guest.lastServerError?.message).toBe("The button is worn out");
  });

  it("receives pushed messages it subscribed to before connecting", async () => {
    const host = newManager();
    const errors: unknown[] = [];
    host.onMessage("ERROR", (payload) => errors.push(payload));
    await host.create();
    host.setName("   ");
    await waitUntil(() => errors.length === 1, "ERROR pushed");
    expect(host.lastServerError?.code).toBe(ErrorCode.INVALID_ACTION);
  });
});

describe("dropped connections", () => {
  it("reconnects automatically and keeps the same state object", async () => {
    const room = await t.createRoom(ROOM);
    const code = (room.state as PressState).roomCode;
    const host = newManager();
    await host.join(code);
    const guest = newManager();
    const sdkRoom = await t.sdk.joinById(room.roomId, { playerId: guest.playerId }, PressState);
    sdkRoom.reconnection.minUptime = 0;
    guest.attach(sdkRoom);
    guest.setName("Guest");
    host.setName("Host");
    await waitUntil(() => guest.state?.phase === "Play", "started");
    const before = guest.state;
    const statuses = observe(() => guest.status);
    room.clients[1]?.leave(CloseCode.MAY_TRY_RECONNECT);
    await waitUntil(() => guest.status === "reconnecting", "dropped");
    await waitUntil(() => guest.status === "connected", "back");
    flushSync();
    expect(statuses.values).toEqual(["connected", "reconnecting", "connected"]);
    expect(guest.state).toBe(before);
    expect(await guest.sendAction("PRESS")).toEqual({ ok: true });
    statuses.stop();
  });
});

describe("resuming after a page reload", () => {
  it("rejoins with the stored token", async () => {
    const { guest } = await startedTable();
    const prefix = `client${prefixes}`;
    const playerId = guest.playerId;
    guest.dispose();
    const reloaded = newManager(prefix);
    expect(reloaded.playerId).toBe(playerId);
    expect(await reloaded.resume()).toBe(true);
    await waitUntil(() => reloaded.me()?.isConnected === true, "seat reattached");
    expect(reloaded.me()?.name).toBe("Guest");
  });

  it("rejoins a reloaded TV as a spectator, never as a seated player", async () => {
    const host = newManager();
    await host.create();
    await waitUntil(() => host.roomCode !== undefined, "code");
    const prefix = `client${++prefixes}`;
    const tv = newManager(prefix);
    await tv.joinAsSpectator(host.roomCode as string);
    expect(localStorage.getItem(`${prefix}.spectator`)).toBe("1");
    tv.dispose();
    await waitUntil(() => host.state?.spectatorCount === 0, "tv gone");
    const reloaded = newManager(prefix);
    expect(await reloaded.resume()).toBe(true);
    await waitUntil(() => host.state?.spectatorCount === 1, "tv back");
    expect(reloaded.isSpectator).toBe(true);
    expect(host.state?.players.size).toBe(1);
  });

  it("falls back to the stored room code when the token is stale", async () => {
    const { guest } = await startedTable();
    const prefix = `client${prefixes}`;
    guest.dispose();
    sessionStorage.setItem(`${prefix}.reconnectionToken`, "stale:token");
    const reloaded = newManager(prefix);
    expect(await reloaded.resume()).toBe(true);
    await waitUntil(() => reloaded.me()?.isConnected === true, "seat reattached");
  });

  it("gives up cleanly when there is nothing to resume or the room is gone", async () => {
    const nothing = newManager();
    expect(await nothing.resume()).toBe(false);
    expect(nothing.status).toBe("idle");
    const prefix = `client${prefixes + 1}`;
    sessionStorage.setItem(`${prefix}.reconnectionToken`, "gone:token");
    localStorage.setItem(`${prefix}.roomCode`, "QQQQ");
    const stale = newManager(prefix);
    expect(await stale.resume()).toBe(false);
    expect(localStorage.getItem(`${prefix}.roomCode`)).toBeNull();
  });
});

describe("being removed", () => {
  it("shows the KICKED error and ends up disconnected", async () => {
    const { host, guest } = await startedTable();
    await host.sendAction("KICK_PLAYER", { playerId: guest.playerId });
    await waitUntil(() => guest.status === "disconnected", "kicked out");
    expect(guest.lastServerError?.code).toBe(ErrorCode.KICKED);
    expect(guest.state).toBeUndefined();
    expect(localStorage.getItem(`client${prefixes}.roomCode`)).toBeNull();
  });

  it("leave() frees the seat and forgets the session so a reload does not rejoin", async () => {
    const { host, guest } = await startedTable();
    const prefix = `client${prefixes}`;
    await guest.leave();
    await waitUntil(() => host.state?.players.size === 1, "seat freed");
    expect(guest.status).toBe("disconnected");
    expect(guest.state).toBeUndefined();
    expect(localStorage.getItem(`${prefix}.roomCode`)).toBeNull();
    expect(sessionStorage.getItem(`${prefix}.reconnectionToken`)).toBeNull();
    expect(await newManager(prefix).resume()).toBe(false);
  });
});
