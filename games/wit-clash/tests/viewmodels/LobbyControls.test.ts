import { describe, expect, it } from "vitest";
import { GameControlsViewModel } from "../../ui/viewmodels/GameControlsViewModel.svelte.js";
import { LobbySettingsViewModel } from "../../ui/viewmodels/LobbySettingsViewModel.svelte.js";
import { connectedClient } from "../helpers/client.js";

describe("LobbySettingsViewModel", () => {
  it("lists the fields of the game and its defaults", () => {
    const vm = new LobbySettingsViewModel(connectedClient({ role: "host" }).manager);
    expect(vm.fields.map((f) => f.key)).toEqual([
      "mode",
      "totalRounds",
      "categoryVoteSeconds",
      "promptSeconds",
      "voteSeconds",
      "revealSeconds",
      "filterLevel",
    ]);
    expect(vm.fields[0]).toEqual({ key: "mode", label: "Mode", options: ["free", "daily"] });
    expect(vm.fields[1]).toEqual({ key: "totalRounds", label: "Total rounds", min: 1, max: 10 });
    expect(vm.fields[6]).toEqual({
      key: "filterLevel",
      label: "Filter level",
      options: ["off", "moderate", "strict"],
    });
    expect(vm.valueOf("mode")).toBe("free");
    expect(vm.valueOf("totalRounds")).toBe("3");
    expect(vm.valueOf("voteSeconds")).toBe("20");
    expect(vm.valueOf("filterLevel")).toBe("moderate");
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
