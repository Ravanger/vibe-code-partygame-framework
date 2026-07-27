import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryVoteViewModel } from "../../ui/viewmodels/CategoryVoteViewModel.svelte.js";
import { fakeManager, makeFakeRoom, makeFakeState, managerWithState } from "../helpers/fakes.js";

describe("CategoryVoteViewModel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows 60 seconds at the start", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(
      managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_060_000 }) as never,
    );
    expect(vm.secondsLeft).toBe(60);
    vm.destroy();
  });

  it("ticks down as time passes", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(
      managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_060_000 }) as never,
    );
    vi.advanceTimersByTime(5_000);
    expect(vm.secondsLeft).toBe(55);
    vm.destroy();
  });

  it("never goes below zero", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(
      managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_030_000 }) as never,
    );
    vi.advanceTimersByTime(100_000);
    expect(vm.secondsLeft).toBe(0);
    vm.destroy();
  });

  it("reports zero when no timer is set", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(managerWithState({ phaseEndsAt: 0 }) as never);
    expect(vm.secondsLeft).toBe(0);
    vm.destroy();
  });

  it("corrects for a skewed client clock", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(
      managerWithState({ serverNow: 2_000_000, phaseEndsAt: 2_030_000 }) as never,
    );
    expect(vm.secondsLeft).toBe(30);
    vm.destroy();
  });

  it("flags the last ten seconds as urgent", () => {
    vi.setSystemTime(1_000_000);
    const vm = new CategoryVoteViewModel(
      managerWithState({ serverNow: 1_000_000_000, phaseEndsAt: 1_000_009_000 }) as never,
    );
    expect(vm.isUrgent).toBe(true);
    vm.destroy();
  });

  it("clears its interval on destroy", () => {
    const vm = new CategoryVoteViewModel(fakeManager() as never);
    vm.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("exposes the three options", () => {
    const state = makeFakeState({
      categoryOptions: [
        { id: "a", name: "A", emoji: "🅰️", votes: 0 },
        { id: "b", name: "B", emoji: "🅱️", votes: 0 },
        { id: "c", name: "C", emoji: "🇨", votes: 0 },
        // biome-ignore lint/suspicious/noExplicitAny: Test setup uses plain objects
      ] as any,
    });
    const vm = new CategoryVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
    expect(vm.options).toHaveLength(3);
    expect(vm.options.map((o) => o.id)).toEqual(["a", "b", "c"]);
    vm.destroy();
  });

  it("knows which option the local player picked", () => {
    const state = makeFakeState({
      categoryOptions: [
        { id: "a", name: "A", emoji: "🅰️", votes: 0 },
        { id: "b", name: "B", emoji: "🅱️", votes: 0 },
        { id: "c", name: "C", emoji: "🇨", votes: 0 },
        // biome-ignore lint/suspicious/noExplicitAny: Test setup uses plain objects
      ] as any,
      categoryVotes: new Map([["me", "b"]]),
    });
    const vm = new CategoryVoteViewModel(
      fakeManager({ room: makeFakeRoom({ state, sessionId: "me" }) }) as never,
    );
    expect(vm.myVote).toBe("b");
    vm.destroy();
  });

  it("sends VOTE_CATEGORY on vote", () => {
    const room = makeFakeRoom();
    const vm = new CategoryVoteViewModel(fakeManager({ room }) as never);
    vm.vote("a");
    expect(room.send).toHaveBeenCalledWith("ACTION", { type: "VOTE_CATEGORY", categoryId: "a" });
    vm.destroy();
  });

  it("allows changing a vote", () => {
    const room = makeFakeRoom();
    const vm = new CategoryVoteViewModel(fakeManager({ room }) as never);
    vm.vote("a");
    vm.vote("b");
    expect(room.send).toHaveBeenCalledTimes(2);
    expect(room.send).toHaveBeenNthCalledWith(1, "ACTION", {
      type: "VOTE_CATEGORY",
      categoryId: "a",
    });
    expect(room.send).toHaveBeenNthCalledWith(2, "ACTION", {
      type: "VOTE_CATEGORY",
      categoryId: "b",
    });
    vm.destroy();
  });
});
