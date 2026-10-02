import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinNextRoundViewModel } from "../../ui/viewmodels/JoinNextRoundViewModel.js";
import { connectedClient, scoreRow } from "../helpers/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
