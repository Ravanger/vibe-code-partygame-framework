import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsViewModel } from "../../ui/viewmodels/ResultsViewModel.svelte.js";
import { fakeManager, makeFakeRoom, makeFakeState } from "../helpers/fakes.js";

describe("ResultsViewModel", () => {
  beforeEach(() => vi.useFakeTimers());

  function makeResultsState(overrides = {}) {
    return makeFakeState({
      phase: "Results",
      roundNumber: 2,
      totalRounds: 3,
      isFinalRound: false,
      scoreboard: [
        {
          playerId: "p1",
          name: "Alice",
          score: 300,
          roundPoints: 100,
          matchupsWon: 1,
          hadClash: false,
        },
        {
          playerId: "p2",
          name: "Bob",
          score: 200,
          roundPoints: 50,
          matchupsWon: 0,
          hadClash: false,
        },
        {
          playerId: "p3",
          name: "Charlie",
          score: 100,
          roundPoints: 0,
          matchupsWon: 0,
          hadClash: false,
        },
      ],
      ...overrides,
    });
  }

  describe("scoreboard", () => {
    it("exposes the scoreboard sorted by score descending", () => {
      const state = makeResultsState();
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.scoreboard).toHaveLength(3);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[0]!.name).toBe("Alice");
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[0]!.score).toBe(300);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[1]!.name).toBe("Bob");
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[2]!.name).toBe("Charlie");
    });

    it("adds rank to each entry", () => {
      const state = makeResultsState();
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[0]!.rank).toBe(1);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[1]!.rank).toBe(2);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[2]!.rank).toBe(3);
    });

    it("handles ties by preserving original order", () => {
      const state = makeResultsState({
        scoreboard: [
          {
            playerId: "p1",
            name: "Alice",
            score: 200,
            roundPoints: 50,
            matchupsWon: 1,
            hadClash: false,
          },
          {
            playerId: "p2",
            name: "Bob",
            score: 200,
            roundPoints: 100,
            matchupsWon: 1,
            hadClash: false,
          },
        ],
      });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[0]!.name).toBe("Alice");
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[0]!.rank).toBe(1);
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[1]!.name).toBe("Bob");
      // biome-ignore lint/style/noNonNullAssertion: Array index guaranteed to exist
      expect(vm.scoreboard[1]!.rank).toBe(1);
    });

    it("handles empty scoreboard", () => {
      const state = makeResultsState({ scoreboard: [] });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.scoreboard).toEqual([]);
    });
  });

  describe("winner", () => {
    it("exposes the first-place player as winner", () => {
      const state = makeResultsState();
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.winner?.name).toBe("Alice");
      expect(vm.winner?.score).toBe(300);
    });

    it("returns undefined when scoreboard is empty", () => {
      const state = makeResultsState({ scoreboard: [] });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.winner).toBeUndefined();
    });
  });

  describe("round info", () => {
    it("exposes roundNumber and totalRounds", () => {
      const state = makeResultsState({ roundNumber: 2, totalRounds: 3 });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.roundNumber).toBe(2);
      expect(vm.totalRounds).toBe(3);
    });

    it("exposes isFinalRound", () => {
      const state = makeResultsState({ isFinalRound: true });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.isFinalRound).toBe(true);
    });

    it("defaults roundNumber to 0 and totalRounds to 3 when missing", () => {
      const state = makeFakeState({ phase: "Results" });
      const vm = new ResultsViewModel(fakeManager({ room: makeFakeRoom({ state }) }) as never);
      expect(vm.roundNumber).toBe(0);
      expect(vm.totalRounds).toBe(3);
    });
  });

  describe("my entry", () => {
    it("exposes the current player's scoreboard entry", () => {
      const state = makeResultsState();
      const vm = new ResultsViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "p2" }) }) as never,
      );
      expect(vm.myEntry?.name).toBe("Bob");
      expect(vm.myEntry?.score).toBe(200);
      expect(vm.myEntry?.roundPoints).toBe(50);
    });

    it("returns undefined when player not on scoreboard", () => {
      const state = makeResultsState();
      const vm = new ResultsViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "unknown" }) }) as never,
      );
      expect(vm.myEntry).toBeUndefined();
    });
  });

  describe("host actions", () => {
    it("detects when current player is host", () => {
      const players = new Map([
        [
          "host-session",
          {
            id: "host-session",
            name: "Host",
            role: "host",
            isReady: true,
            isConnected: true,
          },
        ],
      ]);
      const state = makeResultsState({ players });
      const vm = new ResultsViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "host-session" }) }) as never,
      );
      expect(vm.isHost).toBe(true);
    });

    it("detects when current player is not host", () => {
      const players = new Map([
        [
          "player-session",
          {
            id: "player-session",
            name: "Player",
            role: "player",
            isReady: true,
            isConnected: true,
          },
        ],
      ]);
      const state = makeResultsState({ players });
      const vm = new ResultsViewModel(
        fakeManager({ room: makeFakeRoom({ state, sessionId: "player-session" }) }) as never,
      );
      expect(vm.isHost).toBe(false);
    });

    it("sends NEXT_ROUND when nextRound is called", () => {
      const state = makeResultsState();
      const room = makeFakeRoom({ state });
      const vm = new ResultsViewModel(fakeManager({ room }) as never);
      vm.nextRound();
      expect(room.send).toHaveBeenCalledWith("ACTION", { type: "NEXT_ROUND" });
    });

    it("sends PLAY_AGAIN when playAgain is called", () => {
      const state = makeResultsState();
      const room = makeFakeRoom({ state });
      const vm = new ResultsViewModel(fakeManager({ room }) as never);
      vm.playAgain();
      expect(room.send).toHaveBeenCalledWith("ACTION", { type: "PLAY_AGAIN" });
    });
  });

  describe("edge cases", () => {
    it("handles missing room gracefully", () => {
      const vm = new ResultsViewModel(fakeManager() as never);
      expect(vm.scoreboard).toEqual([]);
      expect(vm.winner).toBeUndefined();
      expect(vm.isFinalRound).toBe(false);
      expect(vm.roundNumber).toBe(0);
    });
  });
});
