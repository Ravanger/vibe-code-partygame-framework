import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BestAnswer } from "../../src/state.js";
import { HonorVoteViewModel } from "../../ui/viewmodels/HonorVoteViewModel.js";
import { addMine, connectedClient } from "../helpers/client.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const best = (authorId: string, authorName: string, text: string): BestAnswer =>
  Object.assign(new BestAnswer(), { authorId, authorName, text });

function honor(mine?: { canVote?: boolean; honorVote?: string }) {
  const c = connectedClient({}, "HonorVote");
  c.state.bestAnswers.push(
    best("p1", "Ann", "a goose"),
    best("p1", "Ann", "a nap"),
    best("p2", "Bob", "soup"),
  );
  c.state.votesCast = 1;
  c.state.votesExpected = 3;
  c.state.serverNow = 1_000_000;
  c.state.phaseEndsAt = 1_000_000 + 20_000;
  if (mine !== undefined) addMine(c.state, c.manager.playerId, mine);
  return { c, vm: new HonorVoteViewModel(c.manager) };
}

describe("HonorVoteViewModel", () => {
  it("lists each candidate once with name and answer, and the clock and turnout", () => {
    const { vm } = honor();
    expect(vm.choices).toEqual([
      { id: "p1", name: "Ann", text: "a goose", isMine: false },
      { id: "p2", name: "Bob", text: "soup", isMine: false },
    ]);
    expect(vm.canVote).toBe(false);
    expect([vm.votesCast, vm.votesExpected]).toEqual([1, 3]);
    expect(vm.secondsLeft).toBe(20);
    expect(vm.totalSeconds).toBe(20);
    expect(vm.announcement).toBe("");
    vm.destroy();
  });

  it("highlights only my own pick", () => {
    const { vm } = honor({ canVote: true, honorVote: "p1" });
    expect(vm.canVote).toBe(true);
    expect(vm.choices.map((choice) => choice.isMine)).toEqual([true, false]);
    vm.destroy();
  });

  it("casts a vote when allowed", async () => {
    const { c, vm } = honor({ canVote: true });
    await vm.vote("p2");
    expect(c.room.requests).toEqual([
      { type: "ACTION", payload: { authorId: "p2", type: "VOTE_HONOR" } },
    ]);
    vm.destroy();
  });

  it("does not cast a vote for the sole candidate", async () => {
    const { c, vm } = honor({ canVote: false });
    await vm.vote("p1");
    expect(c.room.requests).toEqual([]);
    vm.destroy();
  });

  it("is empty without a room", () => {
    const { c, vm } = honor({ canVote: true });
    c.manager.dispose();
    expect([vm.choices, vm.canVote, vm.votesCast, vm.votesExpected]).toEqual([[], false, 0, 0]);
    vm.destroy();
  });
});
