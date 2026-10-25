import { createHash } from "node:crypto";
import { CloseCode } from "@colyseus/core";
import { CLOSE_CODES, PROTOCOL_VERSION } from "@partygame/shared";
import { syncedJsonOf } from "@partygame/shared/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestServer } from "../src/testing/index.js";
import { waitUntil } from "../src/testing/index.js";
import { bootBuzzer, clientState, pid, seat, sleep, startedRoom, stateOf } from "./support.js";

const RECONNECT_MS = 500;
let t: TestServer;
beforeAll(async () => {
  t = await bootBuzzer({ reconnectMs: RECONNECT_MS });
});
afterEach(() => t.cleanup());
afterAll(() => t.shutdown());

describe("GameRoom reconnection", () => {
  it("holds the seat on a dropped connection and restores everything on token reconnect", async () => {
    const { room, p2 } = await startedRoom(t);
    await waitUntil(() => clientState(p2.client).secrets?.size === 1, "secret before drop");
    const token = p2.client.reconnectionToken;
    const syncsBefore = stateOf(room).syncCount;
    await p2.client.leave(false);
    await waitUntil(
      () => stateOf(room).players.get(pid(2))?.isConnected === false,
      "marked disconnected",
    );
    const back = await t.sdk.reconnect(token);
    await waitUntil(
      () => stateOf(room).players.get(pid(2))?.isConnected === true,
      "marked connected",
    );
    expect(stateOf(room).syncCount).toBe(syncsBefore + 1);
    await waitUntil(() => clientState(back).secrets?.has(pid(2)) === true, "secret restored");
    expect([...clientState(back).secrets.keys()]).toEqual([pid(2)]);
    await sleep(RECONNECT_MS + 200);
    expect(stateOf(room).players.has(pid(2))).toBe(true);
  });

  it("forgets a view the game revoked while the player was away", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    const token = p2.client.reconnectionToken;
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).phase === "Done", "done without the absentee");
    p1.client.send("ACTION", { type: "RESET" });
    await waitUntil(() => stateOf(room).phase === "Lobby", "lobby");
    const back = await t.sdk.reconnect(token);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "back");
    await sleep(100);
    expect(clientState(back).secrets?.size ?? 0).toBe(0);
  });

  it("reattaches by playerId from a new session and keeps the seat past the old reservation", async () => {
    const { room, p2 } = await startedRoom(t);
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    const syncsBefore = stateOf(room).syncCount;
    const fresh = await t.join(room, { playerId: pid(2) });
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "reattached");
    expect(stateOf(room).syncCount).toBe(syncsBefore + 1);
    expect(stateOf(room).players.size).toBe(2);
    await waitUntil(() => clientState(fresh).secrets?.has(pid(2)) === true, "view re-applied");
    await sleep(RECONNECT_MS + 200);
    expect(stateOf(room).players.get(pid(2))?.isConnected).toBe(true);
  });

  it("removes the seat when the reservation expires", async () => {
    const { room, p2 } = await startedRoom(t);
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed", RECONNECT_MS + 2000);
  });

  it("refuses the token of a player the host kicked while they were away", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    const token = p2.client.reconnectionToken;
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    await expect(t.sdk.reconnect(token)).rejects.toMatchObject({
      code: CLOSE_CODES.SEAT_REMOVED.code,
      message: CLOSE_CODES.SEAT_REMOVED.message,
    });
    expect(room.clients.length).toBe(1);
    expect(stateOf(room).players.has(pid(2))).toBe(false);
  });

  it("removes the seat immediately on a consented leave", async () => {
    const { room, p2 } = await startedRoom(t);
    await p2.client.leave(true);
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
  });

  it("re-checks the roster when a leaver was the last holdout", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "BUZZ" });
    await waitUntil(() => stateOf(room).buzzCount === 1, "p1 buzzed");
    await p2.client.leave(true);
    await waitUntil(() => stateOf(room).phase === "Done", "finished without the leaver");
  });
});

describe("client continuity across an automatic reconnect", () => {
  it("keeps the same state, player and view objects and keeps applying patches", async () => {
    const { room, p2 } = await startedRoom(t);
    const client = p2.client;
    await waitUntil(() => clientState(client).secrets?.has(pid(2)) === true, "secret before drop");
    const state = clientState(client);
    const player = state.players.get(pid(2));
    const secret = state.secrets.get(pid(2));
    client.reconnection.minUptime = 0;
    client.reconnection.minDelay = 10;
    client.reconnection.delay = 10;
    const reconnected = new Promise<void>((resolve) => client.onReconnect(() => resolve()));
    client.connection.close(CloseCode.MAY_TRY_RECONNECT);
    await reconnected;
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "reattached");
    expect(clientState(client)).toBe(state);
    expect(state.players.get(pid(2))).toBe(player);
    expect(state.secrets.get(pid(2))).toBe(secret);
    const serverSeat = stateOf(room).players.get(pid(2));
    expect(serverSeat).toBeDefined();
    if (serverSeat) serverSeat.name = "Renamed";
    await waitUntil(() => player?.name === "Renamed", "patch reaches the old object");
  });
});

describe("GameRoom host handover", () => {
  it("promotes the first connected seat when the host drops and does not restore the old host", async () => {
    const { room, p1 } = await startedRoom(t);
    const token = p1.client.reconnectionToken;
    await p1.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.role === "host", "promoted");
    expect(stateOf(room).players.get(pid(1))?.role).toBe("player");
    await t.sdk.reconnect(token);
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === true, "back");
    expect(stateOf(room).players.get(pid(1))?.role).toBe("player");
    expect(stateOf(room).players.get(pid(2))?.role).toBe("host");
  });

  it("prefers a seat with a name over an unnamed one, and takes an unnamed one as a last resort", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    await t.join(room, { playerId: pid(2) });
    await seat(t, room, 3);
    await p1.client.leave(true);
    await waitUntil(
      () => stateOf(room).players.get(pid(3))?.role === "host",
      "named seat promoted",
    );
    expect(stateOf(room).players.get(pid(2))?.role).toBe("player");
  });

  it("promotes an unnamed seat when nobody else is connected", async () => {
    const room = await t.createRoom("buzzer");
    const p1 = await seat(t, room, 1);
    await t.join(room, { playerId: pid(2) });
    await p1.client.leave(true);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.role === "host", "unnamed promoted");
  });

  it("promotes when the host leaves for good", async () => {
    const { room, p1 } = await startedRoom(t);
    await p1.client.leave(true);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.role === "host", "promoted");
  });

  it("keeps the host role when nobody else is connected", async () => {
    const { room, p1, p2 } = await startedRoom(t);
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "p2 dropped");
    await p1.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(1))?.isConnected === false, "p1 dropped");
    expect(stateOf(room).players.get(pid(1))?.role).toBe("host");
  });
});

describe("seat secret", () => {
  // Schema-valid (16+ characters) but not pid(2)'s.
  const wrongSecret = "hijacker-secret-0000";

  it("refuses a hijack of a taken seat with the wrong secret and changes nothing", async () => {
    const { room, p2 } = await startedRoom(t);
    await waitUntil(() => clientState(p2.client).secrets?.has(pid(2)) === true, "secret synced");
    await expect(
      t.sdk.joinById(room.roomId, {
        playerId: pid(2),
        seatSecret: wrongSecret,
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).rejects.toMatchObject({
      code: CLOSE_CODES.SEAT_TAKEN.code,
      message: CLOSE_CODES.SEAT_TAKEN.message,
    });
    expect(stateOf(room).players.get(pid(2))).toMatchObject({ name: "P2", isConnected: true });
    expect(clientState(p2.client).secrets?.has(pid(2))).toBe(true);
    expect(room.clients.length).toBe(2);
  });

  it("refuses a re-join of an existing seat without a secret", async () => {
    const { room, p2 } = await startedRoom(t);
    await waitUntil(() => clientState(p2.client).secrets?.has(pid(2)) === true, "secret synced");
    await expect(
      t.sdk.joinById(room.roomId, { playerId: pid(2), protocolVersion: PROTOCOL_VERSION }),
    ).rejects.toMatchObject({
      code: CLOSE_CODES.SEAT_TAKEN.code,
      message: CLOSE_CODES.SEAT_TAKEN.message,
    });
    expect(stateOf(room).players.get(pid(2))?.isConnected).toBe(true);
    expect(clientState(p2.client).secrets?.has(pid(2))).toBe(true);
    expect(room.clients.length).toBe(2);
  });

  it("refuses the first join of a new player without a secret", async () => {
    const { room } = await startedRoom(t);
    await expect(
      t.sdk.joinById(room.roomId, { playerId: "player-0009", protocolVersion: PROTOCOL_VERSION }),
    ).rejects.toMatchObject({
      code: CLOSE_CODES.SEAT_TAKEN.code,
      message: CLOSE_CODES.SEAT_TAKEN.message,
    });
    expect(stateOf(room).players.size).toBe(2);
  });

  it("resumes a dropped seat from a new session that presents the same secret", async () => {
    const { room, p2 } = await startedRoom(t);
    await p2.client.leave(false);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === false, "dropped");
    // TestServer presents the same stable secret it used when p2 first joined.
    const fresh = await t.join(room, { playerId: pid(2) });
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "resumed");
    await waitUntil(() => clientState(fresh).secrets?.has(pid(2)) === true, "view re-applied");
  });

  it("takes the seat over with the right secret and closes the old session with SEAT_TAKEN_OVER", async () => {
    const { room, p2 } = await startedRoom(t);
    const closed = new Promise<number>((resolve) =>
      p2.client.onLeave((code: number) => resolve(code)),
    );
    const fresh = await t.join(room, { playerId: pid(2) });
    expect(await closed).toBe(CLOSE_CODES.SEAT_TAKEN_OVER.code);
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "taken over");
    expect(stateOf(room).players.size).toBe(2);
    await waitUntil(() => clientState(fresh).secrets?.has(pid(2)) === true, "view re-applied");
  });

  it("never puts the secret or its hash in synced state", async () => {
    const { room, p1 } = await startedRoom(t);
    const secret = t.seatSecretFor(pid(1));
    const hash = createHash("sha256").update(secret).digest("hex");
    for (const json of [
      JSON.stringify(syncedJsonOf(stateOf(room))),
      JSON.stringify(clientState(p1.client)),
    ]) {
      expect(json).not.toContain(secret);
      expect(json).not.toContain(hash);
    }
  });

  it("refuses a kicked player who rejoins with a fresh playerId and the same secret", async () => {
    const { room, p1 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    // The kicked client's storage still holds its seat secret; a fresh id does not dodge the ban.
    await expect(
      t.sdk.joinById(room.roomId, {
        playerId: "player-0009",
        seatSecret: t.seatSecretFor(pid(2)),
        protocolVersion: PROTOCOL_VERSION,
      }),
    ).rejects.toMatchObject({
      code: CLOSE_CODES.KICKED_REJOIN.code,
      message: CLOSE_CODES.KICKED_REJOIN.message,
    });
    expect(stateOf(room).players.has("player-0009")).toBe(false);
  });

  it("seats a fresh playerId with a different secret after a kick", async () => {
    const { room, p1 } = await startedRoom(t);
    p1.client.send("ACTION", { type: "KICK_PLAYER", playerId: pid(2) });
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    const client = await t.sdk.joinById(room.roomId, {
      playerId: "player-0009",
      seatSecret: crypto.randomUUID() + crypto.randomUUID(),
      protocolVersion: PROTOCOL_VERSION,
    });
    await waitUntil(() => stateOf(room).players.get("player-0009") !== undefined, "seated");
    await client.leave(true);
  });

  it("lets a player who left normally rejoin with the same secret", async () => {
    const { room, p2 } = await startedRoom(t);
    await p2.client.leave(true);
    await waitUntil(() => !stateOf(room).players.has(pid(2)), "seat removed");
    // A mid-game joiner is seated inactive: the Buzz phase already ran its showTo, so no private view is expected.
    await t.join(room, { playerId: pid(2) });
    await waitUntil(() => stateOf(room).players.get(pid(2))?.isConnected === true, "rejoined");
  });
});
