import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JoinNextRoundViewModel } from "../../ui/viewmodels/JoinNextRoundViewModel.js";
import { WaitingRoomViewModel } from "../../ui/viewmodels/WaitingRoomViewModel.svelte.js";
import { WelcomeViewModel } from "../../ui/viewmodels/WelcomeViewModel.svelte.js";
import { addSeat, connectedClient, scoreRow, stubFetch } from "../helpers/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WelcomeViewModel", () => {
  it("cleans a typed code to four capital letters", () => {
    const vm = new WelcomeViewModel(connectedClient().manager);
    vm.setCode("ab1c-dxyz");
    expect(vm.code).toBe("ABCD");
    expect(vm.codeIsValid).toBe(true);
    vm.setCode("ab");
    expect(vm.codeIsValid).toBe(false);
  });

  it("hosts, and shows why it could not", async () => {
    const network = stubFetch(new Error("Server down"));
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    await vm.host();
    expect(vm.localError).toBe("Server down");
    expect(network.urls.some((url) => url.includes("/matchmake/create/"))).toBe(true);
    vm.dismissError();
    expect(vm.localError).toBeUndefined();
  });

  it("joins with the typed code, and shows why it could not", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.join();
    expect(network.urls).toEqual([expect.stringContaining("code=WXYZ")]);
    expect(vm.localError).toBe("Game code not found");
  });

  it("shows a failure that is not an Error as text", async () => {
    stubFetch("plain failure");
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("wxyz");
    await vm.join();
    expect(vm.localError).toBe("plain failure");
  });

  it("explains a code that is too short without asking the network", async () => {
    const network = stubFetch({ error: "unused" });
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WelcomeViewModel(manager);
    vm.setCode("ab");
    await vm.join();
    expect(vm.localError).toBe("Game code must be 4 letters (A-Z)");
    expect(network.urls).toEqual([]);
  });

  it("is busy only while connecting", () => {
    const { manager } = connectedClient();
    const vm = new WelcomeViewModel(manager);
    expect(vm.busy).toBe(false);
    manager.status = "connecting";
    expect(vm.busy).toBe(true);
  });

  it("joins once from a share link", async () => {
    const network = stubFetch({ error: "Game code not found" });
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WelcomeViewModel(manager, "ABCD");
    await vm.autoJoinIfRequested();
    await vm.autoJoinIfRequested();
    expect(network.urls).toHaveLength(1);
    expect(vm.code).toBe("ABCD");
  });

  it("does nothing without a share link", async () => {
    const network = stubFetch({ error: "unused" });
    const { manager } = connectedClient();
    manager.dispose();
    await new WelcomeViewModel(manager).autoJoinIfRequested();
    expect(network.urls).toEqual([]);
  });
});

describe("WaitingRoomViewModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("lists every seat and counts who is ready and connected", () => {
    const c = connectedClient({ role: "host", name: "Ann" });
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
    const c = connectedClient();
    const vm = new WaitingRoomViewModel(c.manager);
    c.manager.dispose();
    expect(vm.players).toEqual([]);
    expect(vm.minPlayers).toBe(0);
    expect(vm.maxPlayers).toBe(0);
    expect(vm.roomCode).toBe("");
    expect(new WaitingRoomViewModel(c.manager).draftName).toBe("");
  });

  it("lets only the host start, and only when the server says the game can start", async () => {
    const host = connectedClient({ role: "host" });
    const vm = new WaitingRoomViewModel(host.manager);
    expect(vm.isHost).toBe(true);
    expect(vm.canStart).toBe(false);
    await vm.start();
    expect(host.room.requests).toEqual([]);
    host.state.canStart = true;
    expect(vm.canStart).toBe(true);
    await vm.start();
    expect(host.room.requests).toEqual([{ type: "ACTION", payload: { type: "START_GAME" } }]);

    const guest = connectedClient();
    guest.state.canStart = true;
    expect(new WaitingRoomViewModel(guest.manager).canStart).toBe(false);
  });

  it("cannot start without a room", () => {
    const host = connectedClient({ role: "host" });
    const vm = new WaitingRoomViewModel(host.manager);
    host.manager.dispose();
    expect(vm.canStart).toBe(false);
  });

  it("shows the notice about why the last game ended, and leaves the room", async () => {
    const c = connectedClient();
    const vm = new WaitingRoomViewModel(c.manager);
    expect(vm.notice).toBe("");
    c.state.notice = "The host ended the game.";
    expect(vm.notice).toBe("The host ended the game.");
    const leave = vi.spyOn(c.manager, "leave").mockResolvedValue();
    await vm.leave();
    expect(leave).toHaveBeenCalledOnce();
    c.manager.dispose();
    expect(vm.notice).toBe("");
  });

  it("builds the share link from the page address", () => {
    const vm = new WaitingRoomViewModel(connectedClient().manager);
    expect(vm.shareUrl).toBe(`${window.location.origin}${window.location.pathname}?code=ABCD`);
  });

  it("sends the name once typing pauses, trimmed and capped", () => {
    const c = connectedClient();
    const vm = new WaitingRoomViewModel(c.manager);
    vm.setName("A");
    vm.setName("  Alexandria the Magnificent Third  ");
    expect(vm.draftName).toBe("  Alexandria the Magnificent Third  ");
    expect(c.room.sent).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Alexandria the Magni" }]);
  });

  it("does not send a blank name and can cancel a pending one", () => {
    const c = connectedClient();
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
    const vm = new WaitingRoomViewModel(connectedClient().manager);
    await vm.copyCode();
    expect(writeText).toHaveBeenCalledWith("ABCD");
    writeText.mockRejectedValueOnce(new Error("denied"));
    await expect(vm.copyCode()).resolves.toBeUndefined();
  });
});

describe("JoinNextRoundViewModel", () => {
  it("describes the phase in progress and the round", () => {
    const c = connectedClient({ isActive: false }, "Prompting");
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    const vm = new JoinNextRoundViewModel(c.manager);
    expect(vm.phaseLabel).toBe("Everyone is writing answers");
    expect(vm.roundLabel).toBe("Round 2 of 3");
    c.state.phase = "Intermission";
    expect(vm.phaseLabel).toBe("Intermission");
    c.state.roundNumber = 0;
    expect(vm.roundLabel).toBe("");
  });

  it("shows the scoreboard read-only, ranking ties together", () => {
    const c = connectedClient({ isActive: false }, "Results");
    c.state.scoreboard.push(
      scoreRow("a", 300),
      scoreRow("b", 300),
      scoreRow(c.manager.playerId, 100),
    );
    const vm = new JoinNextRoundViewModel(c.manager);
    expect(vm.scoreboard.rows.map((r) => [r.playerId === c.manager.playerId, r.rank])).toEqual([
      [false, 1],
      [false, 1],
      [true, 3],
    ]);
  });

  it("asks for a name until the player has one", () => {
    const c = connectedClient({ isActive: false, isReady: false, name: "" }, "Prompting");
    const vm = new JoinNextRoundViewModel(c.manager);
    expect(vm.needsName).toBe(true);
    expect(vm.heading).toBe("Pick a name to join");
    expect(vm.hint).toBe("You need a name before you can play.");
    c.me.isReady = true;
    expect(vm.needsName).toBe(false);
    expect(vm.heading).toBe("You'll join next round");
    expect(vm.hint).toBe("");
  });

  it("promises the next game, not the next round, during the last round", () => {
    const c = connectedClient({ isActive: false }, "TieBreakerPrompting");
    c.state.roundNumber = 3;
    c.state.totalRounds = 3;
    const vm = new JoinNextRoundViewModel(c.manager);
    expect(vm.heading).toBe("You'll join the next game");
    expect(vm.hint).toBe("You'll join when the host starts a new game.");
    c.state.roundNumber = 2;
    expect(vm.heading).toBe("You'll join next round");
  });

  it("sends the typed name once it pauses, and can cancel it", () => {
    vi.useFakeTimers();
    const c = connectedClient({ isActive: false, isReady: false, name: "" }, "Prompting");
    const vm = new JoinNextRoundViewModel(c.manager);
    vm.nameField.set("Bo");
    vm.destroy();
    vi.advanceTimersByTime(500);
    expect(c.room.sent).toEqual([]);
    vm.nameField.set("Bo");
    vi.advanceTimersByTime(250);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Bo" }]);
  });

  it("falls back when there is no room", () => {
    const c = connectedClient({ isActive: false }, "Results");
    const vm = new JoinNextRoundViewModel(c.manager);
    c.manager.dispose();
    expect(vm.phaseLabel).toBe("Waiting in the lobby");
    expect(vm.roundLabel).toBe("");
    expect(vm.heading).toBe("You'll join next round");
    expect(vm.scoreboard.rows).toEqual([]);
  });
});
