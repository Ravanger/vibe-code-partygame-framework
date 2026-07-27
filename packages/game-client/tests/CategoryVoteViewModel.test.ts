import { describe, expect, it, vi } from "vitest";
import { CategoryVoteViewModel } from "../src/viewmodels/CategoryVoteViewModel.svelte.js";

type CategoryOption = {
  id: string;
  name: string;
  emoji: string;
  votes: number;
};

type MockGameState = {
  categoryOptions: CategoryOption[];
  categoryVotes: Record<string, string>;
  phaseEndsAt: number;
  serverNow: number;
};

describe("CategoryVoteViewModel", () => {
  function makeState(overrides: Partial<MockGameState> = {}): MockGameState {
    return {
      categoryOptions: [
        { id: "cat1", name: "Category One", emoji: "🎯", votes: 0 },
        { id: "cat2", name: "Category Two", emoji: "🎨", votes: 0 },
        { id: "cat3", name: "Category Three", emoji: "🎭", votes: 0 },
      ],
      categoryVotes: {},
      phaseEndsAt: 100000,
      serverNow: 0,
      ...overrides,
    };
  }

  it("should show all categories with vote counts", () => {
    const state = makeState({
      categoryOptions: [
        { id: "cat1", name: "One", emoji: "1️⃣", votes: 2 },
        { id: "cat2", name: "Two", emoji: "2️⃣", votes: 1 },
        { id: "cat3", name: "Three", emoji: "3️⃣", votes: 0 },
      ],
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.categories).toHaveLength(3);
    expect(vm.categories[0].id).toBe("cat1");
    expect(vm.categories[0].votes).toBe(2);
    expect(vm.categories[1].id).toBe("cat2");
    expect(vm.categories[1].votes).toBe(1);
    expect(vm.categories[2].id).toBe("cat3");
    expect(vm.categories[2].votes).toBe(0);
  });

  it("should track selected category from server state", () => {
    const state = makeState({
      categoryVotes: { player1: "cat2" },
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.selectedCategoryId).toBe("cat2");
    expect(vm.hasVoted).toBe(true);
  });

  it("should indicate no vote when player has not voted", () => {
    const state = makeState({
      categoryVotes: { player2: "cat1" },
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.selectedCategoryId).toBe(null);
    expect(vm.hasVoted).toBe(false);
  });

  it("should allow voting when phase is not expired", () => {
    const state = makeState({
      phaseEndsAt: 100000,
      serverNow: 50000,
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.canVote).toBe(true);
  });

  it("should disallow voting when phase is expired", () => {
    const state = makeState({
      phaseEndsAt: 100000,
      serverNow: 100001,
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.canVote).toBe(false);
  });

  it("should send VOTE_CATEGORY message when selecting a category", () => {
    const state = makeState();
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    vm.selectCategory("cat1");

    expect(send).toHaveBeenCalledWith("VOTE_CATEGORY", { categoryId: "cat1" });
  });

  it("should mark category as selected by this player", () => {
    const state = makeState({
      categoryVotes: { player1: "cat2" },
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.categories[0].selected).toBe(false);
    expect(vm.categories[1].selected).toBe(true);
    expect(vm.categories[2].selected).toBe(false);
  });

  it("should provide countdown with correct values", () => {
    const now = 1_000_000;
    const state = makeState({
      phaseEndsAt: now + 65_000,
      serverNow: now,
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.countdown.secondsLeft).toBe(65);
    expect(vm.countdown.isExpired).toBe(false);
  });

  it("should update when game state changes via sync", () => {
    const state = makeState();
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.hasVoted).toBe(false);

    const newState = makeState({
      categoryVotes: { player1: "cat3" },
    });
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    vm.sync(newState as any);
    expect(vm.hasVoted).toBe(true);
    expect(vm.selectedCategoryId).toBe("cat3");
  });

  it("should update vote counts when server updates options via sync", () => {
    const state = makeState();
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.categories[0].votes).toBe(0);

    const newState = makeState({
      categoryOptions: [
        { id: "cat1", name: "One", emoji: "1️⃣", votes: 3 },
        { id: "cat2", name: "Two", emoji: "2️⃣", votes: 0 },
        { id: "cat3", name: "Three", emoji: "3️⃣", votes: 0 },
      ],
    });
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    vm.sync(newState as any);
    expect(vm.categories[0].votes).toBe(3);
  });

  it("should update countdown when serverNow changes via sync", () => {
    const now = 1_000_000;
    const state = makeState({
      phaseEndsAt: now + 10_000,
      serverNow: now,
    });
    const send = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    const vm = new CategoryVoteViewModel(state as any, "player1", send);

    expect(vm.countdown.secondsLeft).toBe(10);

    const newState = makeState({
      phaseEndsAt: now + 10_000,
      serverNow: now + 5_000,
    });
    // biome-ignore lint/suspicious/noExplicitAny: Test setup uses simplified state object
    vm.sync(newState as any);
    expect(vm.countdown.secondsLeft).toBe(5);
  });
});
