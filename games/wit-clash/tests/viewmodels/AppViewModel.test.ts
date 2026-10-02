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

describe("AppViewModel banner", () => {
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
});
