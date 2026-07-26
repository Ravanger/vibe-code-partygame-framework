import { describe, expect, it, vi } from "vitest";
import { WaitingRoomViewModel } from "../../ui/viewmodels/WaitingRoomViewModel.svelte.js";
import { connectedManager, makePlayer } from "../helpers/fakes.js";

describe("WaitingRoomViewModel", () => {
  it("lists players from synced state", () => {
    const players = [makePlayer({ id: "a", name: "Alice" }), makePlayer({ id: "b", name: "Bob" })];
    const m = connectedManager(players);
    const vm = new WaitingRoomViewModel(m as never);
    expect(vm.players).toHaveLength(2);
    expect(vm.players.map((p) => p.name)).toEqual(["Alice", "Bob"]);
  });

  it("marks the local player", () => {
    const players = [
      makePlayer({ id: "me", name: "You" }),
      makePlayer({ id: "other", name: "Them" }),
    ];
    const m = connectedManager(players);
    m.room!.sessionId = "me";
    const vm = new WaitingRoomViewModel(m as never);
    expect(vm.localPlayer?.id).toBe("me");
    expect(vm.localPlayer?.name).toBe("You");
  });

  it("reports host correctly", () => {
    const players = [
      makePlayer({ id: "host", role: "host" }),
      makePlayer({ id: "player", role: "player" }),
    ];
    const m = connectedManager(players);
    m.room!.sessionId = "host";
    const vm = new WaitingRoomViewModel(m as never);
    expect(vm.isHost).toBe(true);
  });

  it("exposes the room code", () => {
    const m = connectedManager([], { roomCode: "PNVW" });
    const vm = new WaitingRoomViewModel(m as never);
    expect(vm.roomCode).toBe("PNVW");
  });

  it("builds a shareable URL containing the code", () => {
    const m = connectedManager([], { roomCode: "ABCD" });
    const vm = new WaitingRoomViewModel(m as never);
    expect(vm.shareUrl).toContain("?code=ABCD");
  });

  describe("live name updates", () => {
    it("debounces SET_NAME to one message per burst", async () => {
      vi.useFakeTimers();
      const m = connectedManager([makePlayer({ id: "me" })]);
      const vm = new WaitingRoomViewModel(m as never);
      vm.setName("A");
      vm.setName("Ad");
      vm.setName("Ada");
      vi.advanceTimersByTime(300);
      expect(m.room?.send).toHaveBeenCalledTimes(1);
      expect(m.room?.send).toHaveBeenCalledWith("SET_NAME", "Ada");
      vi.useRealTimers();
    });

    it("updates draftName immediately for a responsive field", () => {
      const m = connectedManager([makePlayer({ id: "me" })]);
      const vm = new WaitingRoomViewModel(m as never);
      vm.setName("Ada");
      expect(vm.draftName).toBe("Ada");
    });

    it("does not send a blank name", async () => {
      vi.useFakeTimers();
      const m = connectedManager([makePlayer({ id: "me" })]);
      const vm = new WaitingRoomViewModel(m as never);
      vm.setName("   ");
      vi.advanceTimersByTime(300);
      expect(m.room?.send).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("clears the pending timer on destroy", async () => {
      vi.useFakeTimers();
      const m = connectedManager([makePlayer({ id: "me" })]);
      const vm = new WaitingRoomViewModel(m as never);
      vm.setName("Ada");
      vm.destroy();
      vi.advanceTimersByTime(300);
      expect(m.room?.send).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("start button", () => {
    it("is disabled below minPlayers", () => {
      const players = [makePlayer({ id: "a" }), makePlayer({ id: "b" })];
      const m = connectedManager(players);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.canStart).toBe(false);
    });

    it("is enabled at minPlayers", () => {
      const players = [
        makePlayer({ id: "a", role: "host" }),
        makePlayer({ id: "b" }),
        makePlayer({ id: "c" }),
      ];
      const m = connectedManager(players);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.canStart).toBe(true);
    });

    it("counts only ready players", () => {
      const players = [
        makePlayer({ id: "a", role: "host" }),
        makePlayer({ id: "b" }),
        makePlayer({ id: "c", isReady: false }),
      ];
      const m = connectedManager(players);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.readyCount).toBe(2);
      expect(vm.canStart).toBe(false);
    });

    it("counts only connected players", () => {
      const players = [
        makePlayer({ id: "a", role: "host" }),
        makePlayer({ id: "b" }),
        makePlayer({ id: "c", isConnected: false }),
      ];
      const m = connectedManager(players);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.readyCount).toBe(2);
      expect(vm.canStart).toBe(false);
    });

    it("is never enabled for a non-host", () => {
      const players = [
        makePlayer({ id: "a", role: "host" }),
        makePlayer({ id: "b", role: "player" }),
        makePlayer({ id: "c", role: "player" }),
      ];
      const m = connectedManager(players);
      m.room!.sessionId = "b";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.isHost).toBe(false);
      expect(vm.canStart).toBe(false);
    });

    it("sends START_GAME", () => {
      const players = [
        makePlayer({ id: "a", role: "host" }),
        makePlayer({ id: "b" }),
        makePlayer({ id: "c" }),
      ];
      const m = connectedManager(players);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      vm.start();
      expect(m.room?.send).toHaveBeenCalledWith("ACTION", { type: "START_GAME" });
    });

    it("honours a minPlayers override of 1 so one host can start solo", () => {
      const m = connectedManager([makePlayer({ id: "a", role: "host" })]);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never, 1);
      expect(vm.minPlayers).toBe(1);
      expect(vm.readyCount).toBe(1);
      expect(vm.canStart).toBe(true);
    });

    it("defaults minPlayers to 3 when no override is given", () => {
      const m = connectedManager([makePlayer({ id: "a", role: "host" })]);
      m.room!.sessionId = "a";
      const vm = new WaitingRoomViewModel(m as never);
      expect(vm.minPlayers).toBe(3);
      expect(vm.canStart).toBe(false);
    });
  });
});
