import { describe, expect, it } from "vitest";
import { BluffOption, PlayerPrivate } from "../../src/state.js";
import { VotingViewModel } from "../../ui/viewmodels/VotingViewModel.svelte.js";
import { connectedClient } from "../helpers/client.js";

describe("VotingViewModel", () => {
  it("falls back to empty values before any state arrives", () => {
    const { manager } = connectedClient();
    manager.dispose();
    const vm = new VotingViewModel(manager);
    expect(vm.prompt).toBe("");
    expect(vm.roundLabel).toBe("Round 0 of 0");
    expect(vm.choices).toEqual([]);
    expect(vm.votesCast).toBe(0);
    expect(vm.votesExpected).toBe(0);
    expect(vm.voted).toBe(false);
    expect(vm.secondsLeft).toBe(0);
    expect(vm.totalSeconds).toBe(30);
  });

  it("marks the choice the player wrote", () => {
    const c = connectedClient({}, "Voting");
    c.state.promptText = "What is the capital of Australia?";
    c.state.roundNumber = 1;
    c.state.totalRounds = 3;
    c.state.choices.push(
      Object.assign(new BluffOption(), { id: "o1", text: "Canberra" }),
      Object.assign(new BluffOption(), { id: "o2", text: "Sydney" }),
    );
    c.state.mine.set(c.me.id, Object.assign(new PlayerPrivate(), { myOptionId: "o2" }));
    c.state.votesCast = 1;
    c.state.votesExpected = 4;
    const vm = new VotingViewModel(c.manager);

    expect(vm.prompt).toBe("What is the capital of Australia?");
    expect(vm.roundLabel).toBe("Round 1 of 3");
    expect(vm.choices).toEqual([
      { id: "o1", text: "Canberra", isMine: false },
      { id: "o2", text: "Sydney", isMine: true },
    ]);
    expect(vm.votesCast).toBe(1);
    expect(vm.votesExpected).toBe(4);
  });

  it("marks the vote once the server accepts it, and not on a rejection", async () => {
    const c = connectedClient({}, "Voting");
    c.state.choices.push(Object.assign(new BluffOption(), { id: "o1", text: "Canberra" }));
    const vm = new VotingViewModel(c.manager);

    c.room.reply = { ok: false, error: { code: "NOT_ALLOWED", message: "You already voted" } };
    await vm.vote("o1");
    expect(vm.voted).toBe(false);

    c.room.reply = { ok: true };
    await vm.vote("o1");
    expect(vm.voted).toBe(true);
  });
});
