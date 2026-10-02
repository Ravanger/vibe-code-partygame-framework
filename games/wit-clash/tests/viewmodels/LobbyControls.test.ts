import { describe, expect, it, vi } from "vitest";
import { GameControlsViewModel } from "../../ui/viewmodels/GameControlsViewModel.svelte.js";
import { LobbySettingsViewModel } from "../../ui/viewmodels/LobbySettingsViewModel.svelte.js";
import {
  type LobbyPlayer,
  WaitingRoomViewModel,
} from "../../ui/viewmodels/WaitingRoomViewModel.svelte.js";
import { WelcomeViewModel } from "../../ui/viewmodels/WelcomeViewModel.svelte.js";
import { addSeat, connectedClient } from "../helpers/client.js";

function player(id: string, isMe: boolean): LobbyPlayer {
  return { id, name: id, isHost: false, isReady: true, isConnected: true, isMe };
}

describe("LobbySettingsViewModel", () => {
  it("has a field per option and shows the published values, with defaults for the rest", () => {
    const c = connectedClient({ role: "host" });
    c.state.options = JSON.stringify({ totalRounds: 5 });
    const vm = new LobbySettingsViewModel(c.manager);
    expect(vm.fields.map((f) => f.key)).toEqual([
      "totalRounds",
      "categoryVoteSeconds",
      "promptSeconds",
      "voteSeconds",
      "revealSeconds",
    ]);
    expect(vm.valueOf("totalRounds")).toBe("5");
    expect(vm.valueOf("voteSeconds")).toBe("20");
    expect(vm.valueOf("nope")).toBe("");
  });

  it("falls back to the defaults for unusable options or no room", () => {
    const c = connectedClient();
    const vm = new LobbySettingsViewModel(c.manager);
    c.state.options = "{not json";
    expect(vm.valueOf("totalRounds")).toBe("3");
    c.state.options = JSON.stringify({ totalRounds: 99 });
    expect(vm.valueOf("totalRounds")).toBe("3");
    c.manager.dispose();
    expect(vm.valueOf("totalRounds")).toBe("3");
  });

  it("lets only the host edit", async () => {
    const guest = connectedClient();
    const vm = new LobbySettingsViewModel(guest.manager);
    expect(vm.canEdit).toBe(false);
    vm.setDraft("totalRounds", "4");
    await vm.commit("totalRounds");
    expect(guest.room.requests).toEqual([]);
    expect(new LobbySettingsViewModel(connectedClient({ role: "host" }).manager).canEdit).toBe(
      true,
    );
  });

  it("shows what is being typed and sends the number on commit", async () => {
    const host = connectedClient({ role: "host" });
    const vm = new LobbySettingsViewModel(host.manager);
    vm.setDraft("totalRounds", "4");
    expect(vm.valueOf("totalRounds")).toBe("4");
    await vm.commit("totalRounds");
    expect(host.room.requests).toEqual([
      { type: "ACTION", payload: { totalRounds: 4, type: "SET_OPTIONS" } },
    ]);
    expect(vm.valueOf("totalRounds")).toBe("4");
  });

  it("sends nothing when nothing was typed", async () => {
    const host = connectedClient({ role: "host" });
    await new LobbySettingsViewModel(host.manager).commit("totalRounds");
    expect(host.room.requests).toEqual([]);
  });

  it("puts the published value back when the server rejects", async () => {
    const host = connectedClient({ role: "host" });
    host.room.reply = { ok: false, error: { code: "INVALID_ACTION", message: "Too many rounds" } };
    const vm = new LobbySettingsViewModel(host.manager);
    vm.setDraft("totalRounds", "99");
    await vm.commit("totalRounds");
    expect(vm.valueOf("totalRounds")).toBe("3");
    expect(host.manager.lastServerError?.message).toBe("Too many rounds");
  });
});

describe("WaitingRoomViewModel host and TV features", () => {
  function hostLobby() {
    const c = connectedClient({ role: "host", name: "Ann" });
    addSeat(c.state, "bob-1234", { name: "Bob" });
    return c;
  }

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

    const guest = connectedClient();
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
});

describe("WelcomeViewModel TV mode", () => {
  it("watches the typed code as a spectator", async () => {
    const { manager } = connectedClient();
    const watch = vi
      .spyOn(manager, "joinAsSpectator")
      .mockRejectedValueOnce(new Error("No such room"));
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.watch();
    expect(watch).toHaveBeenCalledWith("WXYZ");
    expect(vm.localError).toBe("No such room");
    watch.mockResolvedValueOnce();
    await vm.watch();
    expect(vm.localError).toBeUndefined();
  });

  it("watches once from a TV link, ahead of a share link", async () => {
    const { manager } = connectedClient();
    const watch = vi.spyOn(manager, "joinAsSpectator").mockResolvedValue();
    const join = vi.spyOn(manager, "join").mockResolvedValue();
    const vm = new WelcomeViewModel(manager, "AAAA", "BBBB");
    await vm.autoJoinIfRequested();
    await vm.autoJoinIfRequested();
    expect(watch).toHaveBeenCalledExactlyOnceWith("BBBB");
    expect(join).not.toHaveBeenCalled();
    expect(vm.code).toBe("BBBB");
  });
});

describe("GameControlsViewModel", () => {
  it("is hidden in the lobby, and shown in every other phase", () => {
    const c = connectedClient({ role: "host" });
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.isVisible).toBe(false);
    expect(vm.canEndGame).toBe(false);
    c.state.phase = "Prompting";
    expect(vm.isVisible).toBe(true);
    c.manager.status = "reconnecting";
    expect(vm.isVisible).toBe(true);
    c.manager.status = "disconnected";
    expect(vm.isVisible).toBe(false);
  });

  it("is hidden without a room", () => {
    const c = connectedClient({ role: "host" }, "Prompting");
    const vm = new GameControlsViewModel(c.manager);
    c.manager.dispose();
    expect(vm.isVisible).toBe(false);
  });

  it("lets only the host end the game, after a confirmation", async () => {
    const c = connectedClient({ role: "host" }, "MatchupVoting");
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.canEndGame).toBe(true);
    vm.askEnd();
    expect(vm.confirmingEnd).toBe(true);
    vm.cancelEnd();
    expect(vm.confirmingEnd).toBe(false);
    expect(c.room.requests).toEqual([]);
    vm.askEnd();
    await vm.confirmEnd();
    expect(vm.confirmingEnd).toBe(false);
    expect(c.room.requests).toEqual([{ type: "ACTION", payload: { type: "END_GAME" } }]);
  });

  it("sends nothing for a guest", async () => {
    const c = connectedClient({}, "MatchupVoting");
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.isVisible).toBe(true);
    expect(vm.canEndGame).toBe(false);
    await vm.confirmEnd();
    expect(c.room.requests).toEqual([]);
  });

  it("leaves the room", async () => {
    const c = connectedClient({}, "Prompting");
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    await new GameControlsViewModel(c.manager).leave();
    expect(leave).toHaveBeenCalledOnce();
  });
});

describe("WaitingRoomViewModel name and join info", () => {
  it("decides once whether the name card goes first", () => {
    const c = connectedClient({ name: "", isReady: false });
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.nameFirst).toBe(true);
    expect(vm.needsName).toBe(true);
    c.me.isReady = true;
    expect(vm.nameFirst).toBe(true);
    expect(vm.needsName).toBe(false);
    expect(new WaitingRoomViewModel(c.manager).nameFirst).toBe(false);
  });

  it("shows the QR and code card to the host and the TV only", () => {
    const host = connectedClient({ role: "host" });
    expect(new WaitingRoomViewModel(host.manager).showJoinInfo).toBe(true);
    const guest = connectedClient();
    expect(new WaitingRoomViewModel(guest.manager).showJoinInfo).toBe(false);
    guest.state.players.delete(guest.manager.playerId);
    expect(new WaitingRoomViewModel(guest.manager).showJoinInfo).toBe(true);
  });

  it("tells a named guest to wait for the host, nobody else", () => {
    const guest = connectedClient();
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(true);
    guest.me.isReady = false;
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(false);
    expect(
      new WaitingRoomViewModel(connectedClient({ role: "host" }).manager).showWaitingPanel,
    ).toBe(false);
    guest.me.isReady = true;
    guest.state.players.delete(guest.manager.playerId);
    expect(new WaitingRoomViewModel(guest.manager).showWaitingPanel).toBe(false);
  });
});

describe("LobbySettingsViewModel.startsOpen", () => {
  it("is open for the host and the TV, and folded for a player", () => {
    expect(new LobbySettingsViewModel(connectedClient({ role: "host" }).manager).startsOpen).toBe(
      true,
    );
    const guest = connectedClient();
    expect(new LobbySettingsViewModel(guest.manager).startsOpen).toBe(false);
    guest.state.players.delete(guest.manager.playerId);
    expect(new LobbySettingsViewModel(guest.manager).startsOpen).toBe(true);
  });
});

describe("GameControlsViewModel menu and game over", () => {
  it("opens and closes the menu, dropping a pending confirmation", () => {
    const c = connectedClient({ role: "host" }, "Prompting");
    const vm = new GameControlsViewModel(c.manager);
    vm.toggleMenu();
    expect(vm.menuOpen).toBe(true);
    vm.askEnd();
    vm.toggleMenu();
    expect(vm.menuOpen).toBe(false);
    expect(vm.confirmingEnd).toBe(false);
    vm.toggleMenu();
    vm.askEnd();
    vm.closeMenu();
    expect(vm.menuOpen).toBe(false);
    expect(vm.confirmingEnd).toBe(false);
  });

  it("closes the menu when leaving or ending", async () => {
    const c = connectedClient({ role: "host" }, "Prompting");
    vi.spyOn(c.manager, "leave").mockResolvedValue();
    const vm = new GameControlsViewModel(c.manager);
    vm.toggleMenu();
    await vm.leave();
    expect(vm.menuOpen).toBe(false);
    vm.toggleMenu();
    await vm.confirmEnd();
    expect(vm.menuOpen).toBe(false);
  });

  it("is over only on the final results, and then the host cannot end it", () => {
    const c = connectedClient({ role: "host" }, "Results");
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.isGameOver).toBe(false);
    expect(vm.canEndGame).toBe(true);
    c.state.isFinalRound = true;
    expect(vm.isGameOver).toBe(true);
    expect(vm.canEndGame).toBe(false);
    c.state.phase = "Prompting";
    expect(vm.isGameOver).toBe(false);
    c.manager.dispose();
    expect(vm.isGameOver).toBe(false);
  });

  it("knows a TV display", () => {
    const c = connectedClient({}, "Prompting");
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.isSpectator).toBe(false);
    c.state.players.delete(c.manager.playerId);
    expect(vm.isSpectator).toBe(true);
  });
});
