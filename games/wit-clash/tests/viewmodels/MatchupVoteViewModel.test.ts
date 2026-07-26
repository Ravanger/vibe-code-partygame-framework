import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchupVoteViewModel } from "../../ui/viewmodels/MatchupVoteViewModel.svelte.js";
import { fakeManager, makeFakeRoom, makeFakeState, managerWithState } from "../helpers/fakes.js";

describe("MatchupVoteViewModel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makeMatchupState(overrides = {}) {
    const matchup = {
      id: "m1",
      index: 0,
      promptText: "What's the best way to procrastinate?",
      isRevealed: false,
      answers: [
        { id: "a1", text: "Organize your desk", votes: 0, authorId: "" },
        { id: "a2", text: "Research how birds fly", votes: 0, authorId: "" },
      ],
    };
    return makeFakeState({
      phase: "Voting",
      matchups: [matchup],
      activeMatchupIndex: 0,
      isRevealing: false,
      answerVotes: new Map(),
      serverNow: 1_000_000,
      phaseEndsAt: 1_020_000,
      ...overrides,
    });
  }

  describe("countdown", () => {
    it("shows seconds remaining", () => {
      vi.setSystemTime(1_000_000);
      const vm = new MatchupVoteViewModel(
        managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_020_000 }) as never,
      );
      expect(vm.secondsLeft).toBe(20);
      vm.destroy();
    });

    it("ticks down as time passes", () => {
      vi.setSystemTime(1_000_000);
      const vm = new MatchupVoteViewModel(
        managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_020_000 }) as never,
      );
      vi.advanceTimersByTime(5_000);
      expect(vm.secondsLeft).toBe(15);
      vm.destroy();
    });

    it("never goes below zero", () => {
      vi.setSystemTime(1_000_000);
      const vm = new MatchupVoteViewModel(
        managerWithState({ serverNow: 1_000_000, phaseEndsAt: 1_010_000 }) as never,
      );
      vi.advanceTimersByTime(100_000);
      expect(vm.secondsLeft).toBe(0);
      vm.destroy();
    });

    it("flags the last ten seconds as urgent", () => {
      vi.setSystemTime(1_000_000);
      const vm = new MatchupVoteViewModel(
        managerWithState({ serverNow: 1_000_000_000, phaseEndsAt: 1_000_008_000 }) as never,
      );
      expect(vm.isUrgent).toBe(true);
      vm.destroy();
    });

    it("clears its interval on destroy", () => {
      const vm = new MatchupVoteViewModel(fakeManager() as never);
      vm.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("active matchup", () => {
    it("exposes the active matchup's prompt", () => {
      const state = makeMatchupState();
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.promptText).toBe("What's the best way to procrastinate?");
      vm.destroy();
    });

    it("exposes the two answers", () => {
      const state = makeMatchupState();
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.answers).toHaveLength(2);
      expect(vm.answers.map((a) => a.id)).toEqual(["a1", "a2"]);
      vm.destroy();
    });

    it("returns empty answers when no active matchup", () => {
      const state = makeFakeState({
        phase: "Voting",
        matchups: [],
        activeMatchupIndex: -1,
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.answers).toEqual([]);
      vm.destroy();
    });

    it("returns empty prompt when no active matchup", () => {
      const state = makeFakeState({
        phase: "Voting",
        matchups: [],
        activeMatchupIndex: -1,
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.promptText).toBe("");
      vm.destroy();
    });
  });

  describe("reveal state", () => {
    it("reports not revealed initially", () => {
      const state = makeMatchupState();
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.isRevealed).toBe(false);
      vm.destroy();
    });

    it("reports revealed when matchup is revealed", () => {
      const state = makeMatchupState({
        matchups: [
          {
            id: "m1",
            index: 0,
            promptText: "Prompt",
            isRevealed: true,
            answers: [
              { id: "a1", text: "A", votes: 2, authorId: "p1" },
              { id: "a2", text: "B", votes: 1, authorId: "p2" },
            ],
          },
        ],
        isRevealing: true,
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.isRevealed).toBe(true);
      vm.destroy();
    });

    it("shows author names when revealed", () => {
      const players = new Map([
        [
          "p1",
          {
            id: "p1",
            name: "Alice",
            isReady: true,
            isConnected: true,
            role: "player",
            playerId: "u1",
          },
        ],
        [
          "p2",
          {
            id: "p2",
            name: "Bob",
            isReady: true,
            isConnected: true,
            role: "player",
            playerId: "u2",
          },
        ],
      ]);
      const state = makeMatchupState({
        players,
        matchups: [
          {
            id: "m1",
            index: 0,
            promptText: "Prompt",
            isRevealed: true,
            answers: [
              { id: "a1", text: "A", votes: 2, authorId: "p1" },
              { id: "a2", text: "B", votes: 1, authorId: "p2" },
            ],
          },
        ],
        isRevealing: true,
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.answers[0]?.authorName).toBe("Alice");
      expect(vm.answers[1]?.authorName).toBe("Bob");
      vm.destroy();
    });

    it("hides author names when not revealed", () => {
      const state = makeMatchupState();
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.answers[0]?.authorName).toBe("");
      expect(vm.answers[1]?.authorName).toBe("");
      vm.destroy();
    });
  });

  describe("voting", () => {
    it("sends CAST_VOTE when voting", () => {
      const state = makeMatchupState();
      const room = makeFakeRoom({ state });
      const vm = new MatchupVoteViewModel(fakeManager({ room }) as never);
      vm.vote("a1");
      expect(room.send).toHaveBeenCalledWith("ACTION", { type: "CAST_VOTE", answerId: "a1" });
      vm.destroy();
    });

    it("tracks the local player's vote", () => {
      const state = makeMatchupState({
        answerVotes: new Map([["me", "a2"]]),
      });
      const vm = new MatchupVoteViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "me" }) }) as never,
      );
      expect(vm.myVote).toBe("a2");
      vm.destroy();
    });

    it("returns empty myVote when player has not voted", () => {
      const state = makeMatchupState({
        answerVotes: new Map(),
      });
      const vm = new MatchupVoteViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "me" }) }) as never,
      );
      expect(vm.myVote).toBe("");
      vm.destroy();
    });

    it("allows changing a vote", () => {
      const state = makeMatchupState();
      const room = makeFakeRoom({ state });
      const vm = new MatchupVoteViewModel(fakeManager({ room }) as never);
      vm.vote("a1");
      vm.vote("a2");
      expect(room.send).toHaveBeenCalledTimes(2);
      expect(room.send).toHaveBeenNthCalledWith(1, "ACTION", {
        type: "CAST_VOTE",
        answerId: "a1",
      });
      expect(room.send).toHaveBeenNthCalledWith(2, "ACTION", {
        type: "CAST_VOTE",
        answerId: "a2",
      });
      vm.destroy();
    });
  });

  describe("vote counts", () => {
    it("exposes vote counts for each answer", () => {
      const state = makeMatchupState({
        matchups: [
          {
            id: "m1",
            index: 0,
            promptText: "Prompt",
            isRevealed: false,
            answers: [
              { id: "a1", text: "A", votes: 3, authorId: "" },
              { id: "a2", text: "B", votes: 1, authorId: "" },
            ],
          },
        ],
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.answers[0]?.votes).toBe(3);
      expect(vm.answers[1]?.votes).toBe(1);
      vm.destroy();
    });

    it("reports total votes cast", () => {
      const state = makeMatchupState({
        matchups: [
          {
            id: "m1",
            index: 0,
            promptText: "Prompt",
            isRevealed: false,
            answers: [
              { id: "a1", text: "A", votes: 3, authorId: "" },
              { id: "a2", text: "B", votes: 1, authorId: "" },
            ],
          },
        ],
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.totalVotes).toBe(4);
      vm.destroy();
    });
  });

  describe("edge cases", () => {
    it("handles missing room gracefully", () => {
      const vm = new MatchupVoteViewModel(fakeManager() as never);
      expect(vm.promptText).toBe("");
      expect(vm.answers).toEqual([]);
      expect(vm.isRevealed).toBe(false);
      expect(vm.secondsLeft).toBe(0);
      vm.destroy();
    });

    it("handles invalid activeMatchupIndex gracefully", () => {
      const state = makeFakeState({
        phase: "Voting",
        matchups: [{ id: "m1", answers: [] }],
        activeMatchupIndex: 5,
      });
      const vm = new MatchupVoteViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.promptText).toBe("");
      expect(vm.answers).toEqual([]);
      vm.destroy();
    });
  });
});
