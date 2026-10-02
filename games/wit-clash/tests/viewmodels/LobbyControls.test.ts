import { describe, expect, it } from "vitest";
import { GameControlsViewModel } from "../../ui/viewmodels/GameControlsViewModel.svelte.js";
import { LobbySettingsViewModel } from "../../ui/viewmodels/LobbySettingsViewModel.svelte.js";
import { connectedClient } from "../helpers/client.js";

describe("LobbySettingsViewModel", () => {
  it("lists the fields of the game and its defaults", () => {
    const vm = new LobbySettingsViewModel(connectedClient({ role: "host" }).manager);
    expect(vm.fields.map((f) => f.key)).toEqual([
      "totalRounds",
      "categoryVoteSeconds",
      "promptSeconds",
      "voteSeconds",
      "revealSeconds",
    ]);
    expect(vm.fields[0]).toEqual({ key: "totalRounds", label: "Total rounds", min: 1, max: 10 });
    expect(vm.valueOf("totalRounds")).toBe("3");
    expect(vm.valueOf("voteSeconds")).toBe("20");
  });
});

describe("GameControlsViewModel game over rule", () => {
  it("is over only on the final results, and then the host cannot end it", () => {
    const c = connectedClient({ role: "host" }, "Results");
    const vm = new GameControlsViewModel(c.manager);
    expect(vm.isGameOver).toBe(false);
    expect(vm.canEndGame).toBe(true);
    c.state.isFinalRound = true;
    expect(vm.isGameOver).toBe(true);
    expect(vm.canEndGame).toBe(false);
    c.state.phase = "Prompting";
    expect(vm.canEndGame).toBe(true);
  });
});
