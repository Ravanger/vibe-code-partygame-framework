import { describe, expect, it } from "vitest";
import { ScoreEntry } from "../../src/state.js";
import { ResultsViewModel } from "../../ui/viewmodels/ResultsViewModel.js";
import { connectedClient } from "../helpers/client.js";

const addScore = (
  c: ReturnType<typeof connectedClient>,
  id: string,
  name: string,
  score: number,
): void => {
  c.state.scoreboard.push(Object.assign(new ScoreEntry(), { playerId: id, name, score }));
};

describe("ResultsViewModel", () => {
  it("falls back to empty values before any state arrives", () => {
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new ResultsViewModel(manager);
    expect(vm.rows).toEqual([]);
    expect(vm.headline).toBe("Nobody scored.");
    expect(vm.isHost).toBe(false);
  });

  it("reads the scoreboard as the server wrote it", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 5);
    addScore(c, c.me.id, "Me", 3);
    const vm = new ResultsViewModel(c.manager);
    expect(vm.rows).toEqual([
      { playerId: "ann-12345", name: "Ann", score: 5, hasLeft: false },
      { playerId: c.me.id, name: "Me", score: 3, hasLeft: false },
    ]);
    expect(vm.headline).toBe("Ann wins with 5 points!");
  });

  it("calls a tie and scores of zero correctly", () => {
    const c = connectedClient({}, "Results");
    addScore(c, "ann-12345", "Ann", 4);
    addScore(c, "ben-12345", "Ben", 4);
    const vm = new ResultsViewModel(c.manager);
    expect(vm.headline).toBe("It's a tie!");

    c.state.scoreboard.clear();
    addScore(c, "ann-12345", "Ann", 0);
    expect(vm.headline).toBe("Nobody scored.");
  });

  it("offers play again to the host", async () => {
    const c = connectedClient({ role: "host" }, "Results");
    const vm = new ResultsViewModel(c.manager);
    expect(vm.isHost).toBe(true);
    await vm.playAgain();
    expect(c.room.requests).toContainEqual({ type: "ACTION", payload: { type: "PLAY_AGAIN" } });
  });
});
