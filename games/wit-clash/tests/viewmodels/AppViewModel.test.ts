import { ErrorCode } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { AppViewModel } from "../../ui/viewmodels/AppViewModel.js";
import { connectedClient } from "../helpers/client.js";

describe("AppViewModel.screen", () => {
  it.each(["Lobby", "CategorySelection", "Prompting", "MatchupVoting", "MatchupReveal", "Results"])(
    "routes the %s phase to its screen",
    (phase) => {
      const c = connectedClient({}, phase);
      expect(new AppViewModel(c.manager).screen).toEqual({ kind: "phase", phase });
    },
  );

  it("waits for a phase it does not know", () => {
    const c = connectedClient({}, "Intermission");
    expect(new AppViewModel(c.manager).screen).toEqual({ kind: "connecting" });
  });

  it("shows the welcome screen until connected, including while connecting", () => {
    const c = connectedClient();
    const vm = new AppViewModel(c.manager);
    c.manager.status = "connecting";
    expect(vm.screen).toEqual({ kind: "welcome" });
    c.manager.status = "disconnected";
    expect(vm.screen).toEqual({ kind: "welcome" });
    c.manager.status = "idle";
    expect(vm.screen).toEqual({ kind: "welcome" });
  });

  it("keeps the game on screen while reconnecting", () => {
    const c = connectedClient({}, "Prompting");
    const vm = new AppViewModel(c.manager);
    c.room.dropConnection();
    expect(vm.isReconnecting).toBe(true);
    expect(vm.screen).toEqual({ kind: "phase", phase: "Prompting" });
    c.room.reconnected();
    expect(vm.isReconnecting).toBe(false);
  });

  it("shows a client without a seat the phase screens, as a TV display", () => {
    const c = connectedClient({}, "MatchupVoting");
    const vm = new AppViewModel(c.manager);
    expect(vm.isSpectator).toBe(false);
    c.state.players.delete(c.manager.playerId);
    expect(vm.isSpectator).toBe(true);
    expect(vm.screen).toEqual({ kind: "phase", phase: "MatchupVoting" });
  });

  it("sends a player who is waiting for the next round to the waiting screen, except in the lobby", () => {
    const c = connectedClient({ isActive: false }, "Prompting");
    const vm = new AppViewModel(c.manager);
    expect(vm.screen).toEqual({ kind: "join-next-round" });
    c.state.phase = "Lobby";
    expect(vm.screen).toEqual({ kind: "phase", phase: "Lobby" });
  });
});

describe("AppViewModel tie-breaker and TV routing", () => {
  it.each(["TieBreakerPrompting", "TieBreakerVoting", "TieBreakerReveal"])(
    "routes the %s phase to its screen, seated or not",
    (phase) => {
      const c = connectedClient({}, phase);
      const vm = new AppViewModel(c.manager);
      expect(vm.screen).toEqual({ kind: "phase", phase });
      c.state.players.delete(c.manager.playerId);
      expect(vm.isSpectator).toBe(true);
      expect(vm.screen).toEqual({ kind: "phase", phase });
    },
  );

  it.each(["Lobby", "CategorySelection", "Prompting", "MatchupReveal", "Results"])(
    "shows a seatless TV the %s screen",
    (phase) => {
      const c = connectedClient({}, phase);
      c.state.players.delete(c.manager.playerId);
      expect(new AppViewModel(c.manager).screen).toEqual({ kind: "phase", phase });
    },
  );

  it("sends a player waiting for the next round to the waiting screen during a tie-breaker", () => {
    const c = connectedClient({ isActive: false }, "TieBreakerVoting");
    expect(new AppViewModel(c.manager).screen).toEqual({ kind: "join-next-round" });
  });
});

describe("AppViewModel", () => {
  it("reports the phase and room code, defaulting to the lobby when not in a room", () => {
    const c = connectedClient({}, "Results");
    const vm = new AppViewModel(c.manager);
    expect(vm.phase).toBe("Results");
    expect(vm.roomCode).toBe("ABCD");
    c.manager.dispose();
    expect(vm.phase).toBe("Lobby");
    expect(vm.roomCode).toBe("");
  });

  it("exposes the last server error until dismissed", () => {
    const c = connectedClient();
    const vm = new AppViewModel(c.manager);
    expect(vm.error).toBeUndefined();
    c.room.push("ERROR", { code: ErrorCode.WRONG_PHASE, message: "Not now" });
    expect(vm.error?.message).toBe("Not now");
    vm.dismissError();
    expect(vm.error).toBeUndefined();
  });

  it("keeps showing the kick on the welcome screen", () => {
    const c = connectedClient({}, "Results");
    const vm = new AppViewModel(c.manager);
    c.room.push("ERROR", { code: ErrorCode.KICKED, message: "Removed by the host" });
    c.room.closed();
    expect(vm.screen).toEqual({ kind: "welcome" });
    expect(vm.error?.code).toBe(ErrorCode.KICKED);
  });
});

describe("AppViewModel screen key and banner", () => {
  it("keys the screen by phase, and by route outside the phases", () => {
    const c = connectedClient({}, "Prompting");
    const vm = new AppViewModel(c.manager);
    expect(vm.screenKey).toBe("Prompting");
    c.state.phase = "Intermission";
    expect(vm.screenKey).toBe("connecting");
    c.manager.status = "disconnected";
    expect(vm.screenKey).toBe("welcome");
  });

  it("slaps the vote banner on the first matchup of a round only, and none on the verdict", () => {
    const c = connectedClient({}, "MatchupVoting");
    const vm = new AppViewModel(c.manager);
    c.state.activeMatchupIndex = 0;
    expect(vm.banner).toBe("VOTE TIME!");
    c.state.activeMatchupIndex = 1;
    expect(vm.banner).toBe("");
    c.state.phase = "MatchupReveal";
    expect(vm.banner).toBe("");
    c.state.phase = "Prompting";
    expect(vm.banner).toBe("GET WRITING!");
    c.manager.dispose();
    c.manager.status = "connected";
    expect(vm.banner).toBe("");
  });

  it("announces the phase with its banner, and nothing in the lobby or off the phases", () => {
    const c = connectedClient({}, "MatchupVoting");
    const vm = new AppViewModel(c.manager);
    expect(vm.banner).toBe("VOTE TIME!");
    c.state.phase = "MatchupReveal";
    expect(vm.banner).toBe("");
    c.state.phase = "Lobby";
    expect(vm.banner).toBe("");
    c.manager.status = "disconnected";
    expect(vm.banner).toBe("");
  });
});
