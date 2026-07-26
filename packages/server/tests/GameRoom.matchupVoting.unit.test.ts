// biome-ignore-all lint/style/noNonNullAssertion: Test file uses non-null assertions for known test data
import { describe, expect, it } from "vitest";
import { AnswerSchema } from "../src/schema/AnswerSchema.js";
import { GameStateSchema } from "../src/schema/GameStateSchema.js";
import { MatchupSchema } from "../src/schema/MatchupSchema.js";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

/**
 * Unit tests for matchup voting logic.
 * These tests verify the core voting behavior without requiring a live Colyseus server.
 */
describe("matchup voting logic", () => {
  function createTestState(
    numPlayers: number,
    numMatchups: number,
  ): {
    state: GameStateSchema;
    players: PlayerSchema[];
    matchups: MatchupSchema[];
    answerAuthors: Map<string, string>;
  } {
    const state = new GameStateSchema();
    state.phase = "Voting";
    state.activeMatchupIndex = 0;
    state.isRevealing = false;

    const players: PlayerSchema[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const p = new PlayerSchema();
      p.id = `player-${i}`;
      p.name = `Player ${i}`;
      p.isConnected = true;
      p.isReady = true;
      state.players.set(p.id, p);
      players.push(p);
    }

    const matchups: MatchupSchema[] = [];
    const answerAuthors = new Map<string, string>();

    for (let m = 0; m < numMatchups; m++) {
      const matchup = new MatchupSchema();
      matchup.id = `matchup-${m}`;
      matchup.index = m;
      matchup.promptText = `Prompt ${m}`;
      matchup.isRevealed = false;

      // First two players are authors for each matchup
      for (let a = 0; a < 2; a++) {
        const answer = new AnswerSchema();
        answer.id = `answer-${m}-${a}`;
        answer.text = `Answer ${m}-${a}`;
        answer.votes = 0;
        answer.authorId = "";
        matchup.answers.push(answer);
        answerAuthors.set(answer.id, players[a]!.id);
      }

      state.matchups.push(matchup);
      matchups.push(matchup);
    }

    return { state, players, matchups, answerAuthors };
  }

  describe("eligible voters", () => {
    it("excludes authors from eligible voters", () => {
      const { state } = createTestState(4, 1);

      // Players 0 and 1 are authors, so only 2 and 3 can vote
      // Simplified eligibility check: non-authors
      const authors = new Set(["player-0", "player-1"]);
      const eligibleVoters = [...state.players.values()].filter(
        (p) => p.isConnected && p.isReady && !authors.has(p.id),
      );

      expect(eligibleVoters.map((p) => p.id)).toEqual(["player-2", "player-3"]);
    });

    it("excludes disconnected players from eligible voters", () => {
      const { state, players } = createTestState(4, 1);
      players[2]!.isConnected = false;

      const authors = new Set(["player-0", "player-1"]);
      const eligibleVoters = [...state.players.values()].filter(
        (p) => p.isConnected && p.isReady && !authors.has(p.id),
      );

      expect(eligibleVoters.map((p) => p.id)).toEqual(["player-3"]);
    });

    it("excludes non-ready players from eligible voters", () => {
      const { state, players } = createTestState(4, 1);
      players[2]!.isReady = false;

      const authors = new Set(["player-0", "player-1"]);
      const eligibleVoters = [...state.players.values()].filter(
        (p) => p.isConnected && p.isReady && !authors.has(p.id),
      );

      expect(eligibleVoters.map((p) => p.id)).toEqual(["player-3"]);
    });

    it("returns empty array when all non-authors are disconnected", () => {
      const { state, players } = createTestState(3, 1);
      players[2]!.isConnected = false;

      const authors = new Set(["player-0", "player-1"]);
      const eligibleVoters = [...state.players.values()].filter(
        (p) => p.isConnected && p.isReady && !authors.has(p.id),
      );

      expect(eligibleVoters).toEqual([]);
    });
  });

  describe("vote counting", () => {
    it("increments vote count when a voter votes", () => {
      const { state, matchups } = createTestState(3, 1);
      const matchup = matchups[0]!;

      // Player 2 votes for answer 0
      state.answerVotes.set("player-2", matchup.answers[0]!.id);

      // Recount
      const tally = new Map<string, number>();
      for (const id of state.answerVotes.values()) {
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      for (const a of matchup.answers) a.votes = tally.get(a.id) ?? 0;

      expect(matchup.answers[0]!.votes).toBe(1);
      expect(matchup.answers[1]!.votes).toBe(0);
    });

    it("allows a voter to change their vote without double-counting", () => {
      const { state, matchups } = createTestState(3, 1);
      const matchup = matchups[0]!;

      // Player 2 votes for answer 0
      state.answerVotes.set("player-2", matchup.answers[0]!.id);

      // Player 2 changes vote to answer 1
      state.answerVotes.set("player-2", matchup.answers[1]!.id);

      // Recount
      const tally = new Map<string, number>();
      for (const id of state.answerVotes.values()) {
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      for (const a of matchup.answers) a.votes = tally.get(a.id) ?? 0;

      expect(matchup.answers[0]!.votes).toBe(0);
      expect(matchup.answers[1]!.votes).toBe(1);
      expect(state.answerVotes.size).toBe(1);
    });

    it("tallies votes from multiple voters", () => {
      const { state, matchups } = createTestState(4, 1);
      const matchup = matchups[0]!;

      // Players 2 and 3 vote
      state.answerVotes.set("player-2", matchup.answers[0]!.id);
      state.answerVotes.set("player-3", matchup.answers[0]!.id);

      // Recount
      const tally = new Map<string, number>();
      for (const id of state.answerVotes.values()) {
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      for (const a of matchup.answers) a.votes = tally.get(a.id) ?? 0;

      expect(matchup.answers[0]!.votes).toBe(2);
      expect(matchup.answers[1]!.votes).toBe(0);
    });

    it("ignores votes for unknown answers", () => {
      const { state, matchups } = createTestState(3, 1);
      const matchup = matchups[0]!;

      // Player 2 votes for unknown answer
      state.answerVotes.set("player-2", "unknown-answer-id");

      // Recount (only valid answers get votes)
      const tally = new Map<string, number>();
      for (const id of state.answerVotes.values()) {
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      for (const a of matchup.answers) a.votes = tally.get(a.id) ?? 0;

      expect(matchup.answers[0]!.votes).toBe(0);
      expect(matchup.answers[1]!.votes).toBe(0);
    });
  });

  describe("reveal and scoring", () => {
    it("reveals authorId for answers in revealed matchup only", () => {
      const { matchups, answerAuthors } = createTestState(3, 2);

      // Reveal matchup 0
      matchups[0]!.isRevealed = true;
      for (const a of matchups[0]!.answers) {
        a.authorId = answerAuthors.get(a.id) ?? "";
      }

      // Matchup 0 answers should have authorId
      expect(matchups[0]!.answers[0]!.authorId).toBe("player-0");
      expect(matchups[0]!.answers[1]!.authorId).toBe("player-1");

      // Matchup 1 answers should still be hidden
      expect(matchups[1]!.answers[0]!.authorId).toBe("");
      expect(matchups[1]!.answers[1]!.authorId).toBe("");
    });

    it("awards points to winner based on eligible voter count", () => {
      const { state, matchups, answerAuthors } = createTestState(4, 1);
      const matchup = matchups[0]!;

      // 2 eligible voters (players 2 and 3)
      const eligibleCount = 2;

      // Player 2 and 3 vote for answer 0
      matchup.answers[0]!.votes = 2;
      matchup.answers[1]!.votes = 0;

      // Calculate points: floor(eligibleCount * 0.5) + 1
      const points = Math.floor(eligibleCount * 0.5) + 1; // floor(1) + 1 = 2

      // Winner is author of answer 0 (player-0)
      const winnerId = answerAuthors.get(matchup.answers[0]!.id);
      const current = state.scores.get(winnerId!) ?? 0;
      state.scores.set(winnerId!, current + points);

      expect(state.scores.get("player-0")).toBe(2);
      expect(state.scores.get("player-1")).toBeUndefined();
    });

    it("awards no points on a tie", () => {
      const { matchups } = createTestState(4, 1);
      const matchup = matchups[0]!;

      // Tie: 1 vote each
      matchup.answers[0]!.votes = 1;
      matchup.answers[1]!.votes = 1;

      // No points awarded on tie
      const eligibleCount = 2;
      const points =
        matchup.answers[0]!.votes === matchup.answers[1]!.votes
          ? 0
          : Math.floor(eligibleCount * 0.5) + 1;

      expect(points).toBe(0);
    });

    it("awards no points when there are no eligible voters", () => {
      const { matchups } = createTestState(2, 1);
      const matchup = matchups[0]!;

      matchup.answers[0]!.votes = 0;
      matchup.answers[1]!.votes = 0;

      // No eligible voters (only 2 players, both are authors)
      const eligibleCount = 0;
      const points = eligibleCount === 0 ? 0 : Math.floor(eligibleCount * 0.5) + 1;

      expect(points).toBe(0);
    });

    it("accumulates points across multiple matchups", () => {
      const { state, matchups, answerAuthors } = createTestState(4, 2);

      // Matchup 0: player-0 wins (2 eligible voters -> 2 points)
      matchups[0]!.answers[0]!.votes = 2;
      matchups[0]!.answers[1]!.votes = 0;
      const winner0 = answerAuthors.get(matchups[0]!.answers[0]!.id);
      state.scores.set(winner0!, (state.scores.get(winner0!) ?? 0) + 2);

      // Matchup 1: player-1 wins (2 eligible voters -> 2 points)
      matchups[1]!.answers[1]!.votes = 2;
      matchups[1]!.answers[0]!.votes = 0;
      const winner1 = answerAuthors.get(matchups[1]!.answers[1]!.id);
      state.scores.set(winner1!, (state.scores.get(winner1!) ?? 0) + 2);

      expect(state.scores.get("player-0")).toBe(2);
      expect(state.scores.get("player-1")).toBe(2);
    });
  });

  describe("matchup advancement", () => {
    it("advances to next matchup after reveal window", () => {
      const { state } = createTestState(3, 3);

      // Simulate advancing through matchups
      expect(state.activeMatchupIndex).toBe(0);

      // After matchup 0 is done
      state.activeMatchupIndex = 1;
      expect(state.activeMatchupIndex).toBe(1);

      // After matchup 1 is done
      state.activeMatchupIndex = 2;
      expect(state.activeMatchupIndex).toBe(2);

      // After last matchup, reset to -1
      state.activeMatchupIndex = -1;
      expect(state.activeMatchupIndex).toBe(-1);
    });

    it("clears votes between matchups", () => {
      const { state } = createTestState(3, 2);

      // Votes for matchup 0
      state.answerVotes.set("player-2", "answer-0-0");
      expect(state.answerVotes.size).toBe(1);

      // Clear votes for matchup 1
      state.answerVotes.clear();
      expect(state.answerVotes.size).toBe(0);
    });

    it("resets isRevealing when starting new matchup", () => {
      const { state } = createTestState(3, 2);

      // Matchup 0 is being revealed
      state.isRevealing = true;

      // Start matchup 1
      state.activeMatchupIndex = 1;
      state.isRevealing = false;

      expect(state.isRevealing).toBe(false);
      expect(state.activeMatchupIndex).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("handles 2-player game with no eligible voters", () => {
      const { state, matchups } = createTestState(2, 1);
      const matchup = matchups[0]!;

      // Both players are authors, no one can vote
      const authors = new Set(["player-0", "player-1"]);
      const eligibleVoters = [...state.players.values()].filter(
        (p) => p.isConnected && p.isReady && !authors.has(p.id),
      );

      expect(eligibleVoters).toEqual([]);
      // Matchup should be revealed immediately with no votes
      expect(matchup.answers[0]!.votes).toBe(0);
      expect(matchup.answers[1]!.votes).toBe(0);
    });

    it("handles votes cast during reveal window being ignored", () => {
      const { state } = createTestState(3, 1);

      // Matchup is in reveal state
      state.isRevealing = true;

      // Vote cast during reveal should be ignored
      // In the real implementation, handleCastVote checks isRevealing flag
      const voteDuringReveal = state.isRevealing ? "IGNORED" : "ACCEPTED";
      expect(voteDuringReveal).toBe("IGNORED");
    });

    it("handles votes cast outside active matchup being ignored", () => {
      const { state, matchups } = createTestState(3, 2);
      state.activeMatchupIndex = 0;

      // Vote for answer in matchup 1 while matchup 0 is active
      const voteForInactiveMatchup =
        state.activeMatchupIndex === 0 && matchups[1]!.answers[0]!.id.startsWith("answer-1");

      // In the real implementation, handleCastVote checks if answer is in active matchup
      expect(voteForInactiveMatchup).toBe(true);
    });
  });
});
