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
    expect(vm.clock.secondsLeft).toBe(0);
    expect(vm.clock.totalSeconds).toBe(45);
    expect(vm.clock.announcement).toBe("");
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
    expect(vm.clock.secondsLeft).toBe(12);
    expect(vm.clock.announcement).toBe("");

    c.state.phaseEndsAt = c.state.serverNow + 10_000;
    const urgent = new WritingViewModel(c.manager);
    expect(urgent.clock.secondsLeft).toBe(10);
    expect(urgent.clock.announcement).toBe("10 seconds remaining");
  });

  it("sends the fake answer and resolves true when it is accepted", async () => {
    const c = connectedClient({}, "Writing");
    const vm = new WritingViewModel(c.manager);
    expect(await vm.submit("Sydney")).toBe(true);
    expect(c.room.requests).toContainEqual({
      type: "ACTION",
      payload: { text: "Sydney", type: "SUBMIT_FAKE" },
    });
  });

  it("resolves false on a filter refusal, shows its reason and clears it after a success", async () => {
    const c = connectedClient({}, "Writing");
    const vm = new WritingViewModel(c.manager);
    expect(vm.rejectionReason).toBe("");
    c.room.reply = {
      ok: false,
      error: { code: "CONTENT_REJECTED", message: "contains inappropriate language" },
    };
    expect(await vm.submit("a rude line")).toBe(false);
    expect(vm.rejectionReason).toBe("contains inappropriate language");

    c.room.reply = { ok: true };
    expect(await vm.submit("a kind line")).toBe(true);
    expect(vm.rejectionReason).toBe("");
    expect(c.manager.lastServerError).toBeUndefined();
  });

  it("resolves false on other rejections without a rejection reason", async () => {
    const c = connectedClient({}, "Writing");
    const vm = new WritingViewModel(c.manager);
    c.room.reply = { ok: false, error: { code: "WRONG_PHASE", message: "Too late" } };
    expect(await vm.submit("late")).toBe(false);
    expect(vm.rejectionReason).toBe("");
  });
});
