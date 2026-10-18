import { describe, expect, it } from "vitest";
import { BluffOption, RevealEntry } from "../../src/state.js";
import { RevealViewModel } from "../../ui/viewmodels/RevealViewModel.js";
import { connectedClient } from "../helpers/client.js";

describe("RevealViewModel", () => {
  it("falls back to empty values before any state arrives", () => {
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new RevealViewModel(manager);
    expect(vm.roundLabel).toBe("Round 0 of 0");
    expect(vm.choices).toEqual([]);
    expect(vm.results).toEqual([]);
    expect(vm.secondsLeft).toBe(0);
    expect(vm.totalSeconds).toBe(15);
  });

  it("shows every choice with its author, votes and the truth mark", () => {
    const c = connectedClient({}, "Reveal");
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    c.state.truthRevealedId = "o1";
    c.state.choices.push(
      Object.assign(new BluffOption(), {
        id: "o1",
        text: "Canberra",
        authorName: "The game",
        votes: 2,
      }),
      Object.assign(new BluffOption(), { id: "o2", text: "Sydney", authorName: "Ann", votes: 1 }),
    );
    c.state.results.push(
      Object.assign(new RevealEntry(), {
        playerId: "ann-12345",
        name: "Ann",
        roundPoints: 3,
        fooledCount: 0,
        guessedTruth: true,
      }),
    );
    const vm = new RevealViewModel(c.manager);

    expect(vm.roundLabel).toBe("Round 2 of 3");
    expect(vm.choices).toEqual([
      { id: "o1", text: "Canberra", authorName: "The game", votes: 2, isTruth: true },
      { id: "o2", text: "Sydney", authorName: "Ann", votes: 1, isTruth: false },
    ]);
    expect(vm.results).toEqual([
      { playerId: "ann-12345", name: "Ann", roundPoints: 3, fooledCount: 0, guessedTruth: true },
    ]);
  });
});
