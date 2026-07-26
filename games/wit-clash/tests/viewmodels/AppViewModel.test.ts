import { describe, expect, it } from "vitest";
import { AppViewModel } from "../../ui/viewmodels/AppViewModel.svelte.js";

/** Minimal stand-in for GameConnectionManager. */
function fakeManager(
  over: Partial<{
    connectionStatus: string;
    error?: string;
    room?: { state?: { phase?: string } };
  }> = {},
) {
  return {
    connectionStatus: "disconnected",
    stateVersion: 0,
    room: undefined,
    error: undefined,
    ...over,
  };
}

describe("AppViewModel.screen", () => {
  // THE regression test for the reported bug.
  it("shows welcome (NOT an error page) on a fresh disconnected load", () => {
    const vm = new AppViewModel(fakeManager() as never);
    expect(vm.screen).toBe("welcome");
  });

  it("shows welcome after a failed connection, so the user can retry", () => {
    const vm = new AppViewModel(
      fakeManager({ connectionStatus: "error", error: "Room not found" }) as never,
    );
    expect(vm.screen).toBe("welcome");
    expect(vm.errorMessage).toBe("Room not found");
  });

  it("shows connecting while in flight", () => {
    const vm = new AppViewModel(fakeManager({ connectionStatus: "connecting" }) as never);
    expect(vm.screen).toBe("connecting");
  });

  it("shows the waiting room once connected in the Lobby phase", () => {
    const vm = new AppViewModel(
      fakeManager({
        connectionStatus: "connected",
        room: { state: { phase: "Lobby" } },
      }) as never,
    );
    expect(vm.screen).toBe("waiting-room");
  });

  it("maps each game phase to its screen", () => {
    const cases: Array<[string, string]> = [
      ["Lobby", "waiting-room"],
      ["CategorySelection", "category-vote"],
      ["Prompting", "prompting"],
      ["Voting", "matchup-vote"],
      ["Results", "results"],
    ];
    for (const [phase, screen] of cases) {
      const vm = new AppViewModel(
        fakeManager({
          connectionStatus: "connected",
          room: { state: { phase } },
        }) as never,
      );
      expect(vm.screen).toBe(screen);
    }
  });

  it("falls back to unsupported for an unknown phase", () => {
    const vm = new AppViewModel(
      fakeManager({
        connectionStatus: "connected",
        room: { state: { phase: "Wat" } },
      }) as never,
    );
    expect(vm.screen).toBe("unsupported");
  });

  it("never returns an error screen for any status", () => {
    for (const s of ["disconnected", "connecting", "connected", "error"]) {
      const vm = new AppViewModel(fakeManager({ connectionStatus: s }) as never);
      expect(vm.screen).not.toBe("error");
    }
  });
});
