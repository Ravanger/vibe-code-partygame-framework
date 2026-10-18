import { describe, expect, it } from "vitest";
import { WritingViewModel } from "../../ui/viewmodels/WritingViewModel.js";
import { addSeat, connectedClient } from "../helpers/client.js";

describe("WritingViewModel", () => {
  it("falls back to empty values before any state arrives", () => {
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new WritingViewModel(manager);
    expect(vm.prompt).toBe("");
    expect(vm.roundLabel).toBe("Round 0 of 0");
    expect(vm.rows).toEqual([]);
    expect(vm.myDone).toBe(false);
    expect(vm.secondsLeft).toBe(0);
    expect(vm.totalSeconds).toBe(45);
    expect(vm.announcement).toBe("");
  });

  it("reads the prompt, the round and who has written", () => {
    const c = connectedClient({}, "Writing");
    addSeat(c.state, "ann-12345", { name: "Ann" });
    c.state.promptText = "What is the capital of Australia?";
    c.state.roundNumber = 2;
    c.state.totalRounds = 3;
    c.state.progress.set("ann-12345", true);
    const vm = new WritingViewModel(c.manager);

    expect(vm.prompt).toBe("What is the capital of Australia?");
    expect(vm.roundLabel).toBe("Round 2 of 3");
    expect(vm.rows).toEqual([
      { id: c.me.id, name: "Me", done: false, isMe: true },
      { id: "ann-12345", name: "Ann", done: true, isMe: false },
    ]);
    expect(vm.myDone).toBe(false);
  });

  it("counts down the phase on the server's clock", () => {
    const c = connectedClient({}, "Writing");
    c.state.serverNow = 1_000_000_000;
    c.state.phaseEndsAt = c.state.serverNow + 12_000;
    const vm = new WritingViewModel(c.manager);
    expect(vm.secondsLeft).toBe(12);
    expect(vm.announcement).toBe("");

    c.state.phaseEndsAt = c.state.serverNow + 10_000;
    const urgent = new WritingViewModel(c.manager);
    expect(urgent.secondsLeft).toBe(10);
    expect(urgent.announcement).toBe("10 seconds remaining");
  });

  it("sends the fake answer", async () => {
    const c = connectedClient({}, "Writing");
    const vm = new WritingViewModel(c.manager);
    await vm.submit("Sydney");
    expect(c.room.requests).toContainEqual({
      type: "ACTION",
      payload: { text: "Sydney", type: "SUBMIT_FAKE" },
    });
  });
});
