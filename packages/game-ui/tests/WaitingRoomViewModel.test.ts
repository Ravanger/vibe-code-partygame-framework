import { addSeat, connectedClient, type SeatConfig } from "@partygame/game-client/testing";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LobbyPlayer, WaitingRoomViewModel } from "../src/WaitingRoomViewModel.svelte.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const client = (seat: SeatConfig = {}) =>
  connectedClient({
    stateClass: BaseGameState,
    seat,
    setup: (state) => {
      state.minPlayers = 3;
      state.maxPlayers = 8;
    },
  });

const player = (id: string, isMe: boolean): LobbyPlayer => ({
  id,
  name: id,
  isHost: false,
  isReady: true,
  isConnected: true,
  isMe,
});

const hostLobby = () => {
  const c = client({ role: "host", name: "Ann" });
  addSeat(c.state, "bob-1234", { name: "Bob" });
  return c;
};

describe("WaitingRoomViewModel", () => {
  it("lists every seat and counts who is ready and connected", () => {
    const c = client({ role: "host", name: "Ann" });
    addSeat(c.state, "bob-1234", { name: "Bob" });
    addSeat(c.state, "cy-12345", { name: "", isReady: false });
    addSeat(c.state, "di-12345", { name: "Di", isConnected: false });
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.players.map((p) => [p.name, p.isHost, p.isMe, p.isReady, p.isConnected])).toEqual([
      ["Ann", true, true, true, true],
      ["Bob", false, false, true, true],
      ["", false, false, false, true],
      ["Di", false, false, true, false],
    ]);
    expect(vm.readyCount).toBe(2);
    expect(vm.roomCode).toBe("ABCD");
    expect(vm.minPlayers).toBe(3);
    expect(vm.maxPlayers).toBe(8);
    expect(vm.draftName).toBe("Ann");
  });

  it("falls back when there is no room yet", () => {
    const c = client();
    const vm = new WaitingRoomViewModel(c.manager);
    c.manager.dispose();
    expect(vm.players).toEqual([]);
    expect(vm.minPlayers).toBe(0);
    expect(vm.maxPlayers).toBe(0);
    expect(vm.roomCode).toBe("");
    expect(new WaitingRoomViewModel(c.manager).draftName).toBe("");
  });

  it("lets only the host start, and only when the server says the game can start", async () => {
    const host = client({ role: "host" });
    const vm = new WaitingRoomViewModel(host.manager);
    expect(vm.isHost).toBe(true);
    expect(vm.canStart).toBe(false);
    await vm.start();
    expect(host.room.requests).toEqual([]);
    host.state.canStart = true;
    expect(vm.canStart).toBe(true);
    await vm.start();
    expect(host.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);

    const guest = client();
    guest.state.canStart = true;
    expect(new WaitingRoomViewModel(guest.manager).canStart).toBe(false);
  });

  it("cannot start without a room", () => {
    const host = client({ role: "host" });
    const vm = new WaitingRoomViewModel(host.manager);
    host.manager.dispose();
    expect(vm.canStart).toBe(false);
  });

  it("shows the notice about why the last game ended, and leaves the room", async () => {
    const c = client();
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.notice).toBe("");
    c.state.notice = "x";
    expect(vm.notice).toBe("x");
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    await vm.leave();
    expect(leave).toHaveBeenCalledOnce();
    c.manager.dispose();
    expect(vm.notice).toBe("");
  });

  it("builds the share link from the page address", () => {
    const vm = new WaitingRoomViewModel(client().manager);
    expect(vm.shareUrl).toBe(`${window.location.origin}${window.location.pathname}?code=ABCD`);
  });

  it("sends the name once typing pauses, trimmed and capped", () => {
    const c = client();
    const vm = new WaitingRoomViewModel(c.manager);
    vm.setName("A");
    vm.setName("  Alexandria the Magnificent Third  ");
    expect(vm.draftName).toBe("  Alexandria the Magnificent Third  ");
    expect(c.room.sent).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Alexandria the Magni" }]);
  });

  it("does not send a blank name and can cancel a pending one", () => {
    const c = client();
    const vm = new WaitingRoomViewModel(c.manager);
    vm.setName("   ");
    vm.setName("Bo");
    vm.destroy();
    vi.advanceTimersByTime(500);
    expect(c.room.sent).toEqual([]);
  });

  it("copies the room code and survives a denied clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const vm = new WaitingRoomViewModel(client().manager);
    await vm.copyCode();
    expect(writeText).toHaveBeenCalledWith("ABCD");
    writeText.mockRejectedValueOnce(new Error("denied"));
    await expect(vm.copyCode()).resolves.toBeUndefined();
  });

  it("lets the host remove others only, after a confirmation", async () => {
    const c = hostLobby();
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.canKick(player("ann", true))).toBe(false);
    expect(vm.canKick(player("bob-1234", false))).toBe(true);
    vm.askKick("bob-1234");
    expect(vm.kickCandidate).toBe("bob-1234");
    vm.cancelKick();
    expect(vm.kickCandidate).toBeUndefined();
    expect(c.room.requests).toEqual([]);
    vm.askKick("bob-1234");
    await vm.confirmKick();
    expect(vm.kickCandidate).toBeUndefined();
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { playerId: "bob-1234", type: "KICK_PLAYER" } },
    ]);
  });

  it("does not remove anyone without a pending confirmation or as a guest", async () => {
    const host = hostLobby();
    await new WaitingRoomViewModel(host.manager).confirmKick();
    expect(host.room.requests).toEqual([]);

    const guest = client();
    const vm = new WaitingRoomViewModel(guest.manager);
    expect(vm.canKick(player("bob-1234", false))).toBe(false);
    vm.askKick("bob-1234");
    await vm.confirmKick();
    expect(guest.room.requests).toEqual([]);
  });

  it("knows a TV display and counts the TVs watching", () => {
    const c = hostLobby();
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.isSpectator).toBe(false);
    expect(vm.spectatorCount).toBe(0);
    c.state.spectatorCount = 2;
    c.state.players.delete(c.manager.playerId);
    expect(vm.isSpectator).toBe(true);
    expect(vm.spectatorCount).toBe(2);
    c.manager.dispose();
    expect(vm.spectatorCount).toBe(0);
  });

  it("decides once whether the name card goes first", () => {
    const c = client({ name: "", isReady: false });
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.nameFirst).toBe(true);
    expect(vm.needsName).toBe(true);
    c.me.isReady = true;
    expect(vm.nameFirst).toBe(true);
    expect(vm.needsName).toBe(false);
    expect(new WaitingRoomViewModel(c.manager).nameFirst).toBe(false);
  });

  it("shows the QR and code card to the host and the TV only", () => {
    const host = client({ role: "host" });
    expect(new WaitingRoomViewModel(host.manager).showJoinInfo).toBe(true);
    const guest = client();
    expect(new WaitingRoomViewModel(guest.manager).showJoinInfo).toBe(false);
    guest.state.players.delete(guest.manager.playerId);
    expect(new WaitingRoomViewModel(guest.manager).showJoinInfo).toBe(true);
  });

  it("tells a named guest to wait for the host, nobody else", () => {
    const guest = client();
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(true);
    guest.me.isReady = false;
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(false);
    expect(new WaitingRoomViewModel(client({ role: "host" }).manager).showWaitingPanel).toBe(false);
    guest.me.isReady = true;
    guest.state.players.delete(guest.manager.playerId);
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(false);
  });
});
