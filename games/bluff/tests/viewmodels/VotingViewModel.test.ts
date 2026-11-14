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
    expect(vm.clock.secondsLeft).toBe(0);
    expect(vm.clock.totalSeconds).toBe(30);
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
      { id: "o1", text: "Canberra", own: false, picked: false },
      { id: "o2", text: "Sydney", own: true, picked: false },
    ]);
    expect(vm.votesCast).toBe(1);
    expect(vm.votesExpected).toBe(4);
    expect(vm.voted).toBe(false);
  });

  it("shows the voted state from the synced private state after a reload", () => {
    const c = connectedClient({}, "Voting");
    c.state.choices.push(Object.assign(new BluffOption(), { id: "o1", text: "Canberra" }));
    c.state.mine.set(
      c.me.id,
      Object.assign(new PlayerPrivate(), { myOptionId: "o1", myVote: "o2" }),
    );
    const vm = new VotingViewModel(c.manager);
    expect(vm.voted).toBe(true);
  });

  it("sends the cast vote action", async () => {
    const c = connectedClient({}, "Voting");
    c.state.choices.push(Object.assign(new BluffOption(), { id: "o1", text: "Canberra" }));
    const vm = new VotingViewModel(c.manager);
    await vm.vote("o1");
    expect(c.room.requests).toContainEqual({
      type: "ACTION",
      payload: { optionId: "o1", type: "CAST_VOTE" },
    });
  });

  it("keeps the vote uncast when the server refuses it", async () => {
    const c = connectedClient({}, "Voting");
    c.state.choices.push(Object.assign(new BluffOption(), { id: "o1", text: "Canberra" }));
    c.room.reply = { ok: false, error: { code: "NOT_ALLOWED", message: "You already voted" } };
    const vm = new VotingViewModel(c.manager);
    await vm.vote("o1");
    expect(vm.voted).toBe(false);
  });
});
