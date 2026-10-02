import { describe, expect, it } from "vitest";
import { PHASE } from "../../src/phaseNames.js";
import { BestAnswer, WitClashState } from "../../src/state.js";
import { Narrator } from "../../terminal/Narrator.js";
import { answer, matchup, option, row, seat } from "./support.js";

const setup = () => ({ narrator: new Narrator(), state: new WitClashState() });

const revealed = (over: Partial<ReturnType<typeof matchup>> = {}) =>
  matchup(
    "m1",
    "Why?",
    [
      answer("a1", "Because", { authorId: "p1", authorName: "Ann", votes: 2, isWinner: true }),
      answer("a2", "Why not", { authorId: "p2", authorName: "Bob", votes: 1 }),
    ],
    { isRevealed: true, ...over },
  );

describe("Narrator", () => {
  it("tells who is in the lobby when the roster changes, and the notice once", () => {
    const { narrator, state } = setup();
    seat(state, "p1", "Ann");
    seat(state, "p2", "");
    expect(narrator.update(state)).toEqual(["Lobby, 1 player: Ann"]);
    expect(narrator.update(state)).toEqual([]);
    seat(state, "p2", "Bob");
    state.notice = "The host ended the game.";
    expect(narrator.update(state)).toEqual([
      "Lobby, 2 players: Ann, Bob",
      "The host ended the game.",
    ]);
    expect(narrator.update(state)).toEqual([]);
    state.notice = "";
    expect(narrator.update(state)).toEqual([]);
  });

  it("offers the categories, names the chosen one and says everyone is writing", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.CategorySelection;
    state.roundNumber = 1;
    state.totalRounds = 2;
    state.categoryOptions.push(option("a"), option("b", 2));
    expect(narrator.update(state)).toEqual([
      "",
      "=== Round 1 of 2 ===",
      "Categories offered:",
      "  1) Name a",
      "  2) Name b",
    ]);
    state.phase = PHASE.Prompting;
    state.selectedCategory = "b";
    expect(narrator.update(state)).toEqual([
      "Category chosen: Name b (2 votes)",
      "Everyone is writing answers...",
    ]);
    expect(narrator.update(state)).toEqual([]);
  });

  it("says only that everyone is writing when no category matches", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.Prompting;
    expect(narrator.update(state)).toEqual(["Everyone is writing answers..."]);
  });

  it("lists the answers of the matchup being voted on, without authors", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.MatchupVoting;
    state.roundNumber = 1;
    state.matchups.push(matchup("m1", "Why?", [answer("a1", "Because"), answer("a2", "Why not")]));
    state.activeMatchupIndex = 0;
    expect(narrator.update(state)).toEqual([
      "",
      "Matchup 1 of 1: Why?",
      '  1) "Because"',
      '  2) "Why not"',
    ]);
    expect(narrator.update(state)).toEqual([]);
  });

  it("reveals authors, votes and points, marking a winner and a clash", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.MatchupVoting;
    state.roundNumber = 1;
    const shown = revealed({ isRevealed: false });
    state.matchups.push(shown);
    state.activeMatchupIndex = 0;
    narrator.update(state);
    state.phase = PHASE.MatchupReveal;
    shown.isRevealed = true;
    expect(narrator.update(state)).toEqual([
      '  "Because" by Ann: 2 votes, +250 points - winner',
      '  "Why not" by Bob: 1 vote, +100 points',
    ]);
    const clash = new WitClashState();
    clash.roundNumber = 1;
    clash.phase = PHASE.MatchupReveal;
    clash.matchups.push(revealed({ isClash: true }));
    expect(new Narrator().update(clash)[2]).toBe(
      '  "Because" by Ann: 2 votes, +400 points - CLASH, winner',
    );
  });

  it("shows the prompt and a forfeit note when a matchup is revealed unseen", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.MatchupReveal;
    state.roundNumber = 1;
    state.matchups.push(
      matchup(
        "m1",
        "Why?",
        [answer("a1", "Because", { authorId: "p1", authorName: "Ann", isWinner: true })],
        { isRevealed: true, isForfeit: true },
      ),
    );
    expect(narrator.update(state)).toEqual([
      "",
      "Matchup 1 of 1: Why?",
      "  Only one answer came in, so it wins without a vote.",
      '  "Because" by Ann: 0 votes, +50 points - winner',
    ]);
  });

  it("narrates a tie-breaker from prompt to reveal without scoring it", () => {
    const { narrator, state } = setup();
    seat(state, "p1", "Ann");
    seat(state, "p2", "Bob");
    narrator.update(state);
    state.phase = PHASE.TieBreakerPrompting;
    state.tieBreakerContenders.push("p1", "p2", "ghost");
    state.tieBreakers.push(
      matchup("t1", "Tie?", [
        answer("x1", "One", { authorId: "p1", authorName: "Ann", votes: 1, isWinner: true }),
        answer("x2", "Two", { authorId: "p2", authorName: "Bob" }),
      ]),
    );
    expect(narrator.update(state)).toEqual([
      "",
      "TIE-BREAKER: Ann and Bob and ghost are level at the top and answer one more prompt.",
    ]);
    state.phase = PHASE.TieBreakerVoting;
    expect(narrator.update(state)).toEqual([
      "Tie-breaker prompt: Tie?",
      '  1) "One"',
      '  2) "Two"',
    ]);
    state.phase = PHASE.TieBreakerReveal;
    const latest = state.tieBreakers[0];
    if (latest) latest.isRevealed = true;
    expect(narrator.update(state)).toEqual([
      '  "One" by Ann: 1 vote - winner',
      '  "Two" by Bob: 0 votes',
    ]);
    state.scoreboard.push(row("p1", "Ann", 1, { wonTieBreaker: true }), row("p2", "Bob", 0));
    expect(narrator.discrepancies(state)).toEqual([]);
  });

  it("notes a tie-breaker settled by a forfeit", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.TieBreakerReveal;
    state.tieBreakers.push(
      matchup("t1", "Tie?", [answer("x1", "One", { authorName: "Ann", isWinner: true })], {
        isRevealed: true,
        isForfeit: true,
      }),
    );
    expect(narrator.update(state)[0]).toBe("  Only one answer came in, so it wins without a vote.");
  });

  it("prints the scoreboard after a round without a winner", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.Results;
    state.roundNumber = 1;
    state.scoreboard.push(
      row("p1", "Ann", 300, { roundPoints: 300 }),
      row("p2", "Bob", 0, { hasLeft: true }),
    );
    expect(narrator.update(state)).toEqual([
      "",
      "=== Scores after round 1 ===",
      "  1. Ann: 300 (+300 this round)",
      "  2. Bob: 0 (left)",
    ]);
    expect(narrator.update(state)).toEqual([]);
  });

  it("names the final winner by tie-breaker, alone, or shared, and lists best answers", () => {
    const finalState = (rows: ReturnType<typeof row>[]) => {
      const state = new WitClashState();
      state.phase = PHASE.Results;
      state.isFinalRound = true;
      state.roundNumber = 1;
      for (const each of rows) state.scoreboard.push(each);
      return state;
    };
    const decided = finalState([
      row("p1", "Ann", 101, { wonTieBreaker: true }),
      row("p2", "Bob", 100),
    ]);
    expect(new Narrator().update(decided).at(-1)).toBe("Winner: Ann with 101 points");
    const alone = finalState([row("p1", "Ann", 200), row("p2", "Bob", 100)]);
    alone.bestAnswers.push(
      Object.assign(new BestAnswer(), {
        text: "Wow",
        authorName: "Ann",
        promptText: "Why?",
        votes: 1,
      }),
    );
    const lines = new Narrator().update(alone);
    expect(lines).toContain("=== Final scores ===");
    expect(lines.at(-2)).toBe("Winner: Ann with 200 points");
    expect(lines.at(-1)).toBe('Best answer: "Wow" by Ann for "Why?" (1 vote)');
    const shared = finalState([row("p1", "Ann", 100), row("p2", "Bob", 100)]);
    expect(new Narrator().update(shared).at(-1)).toBe("Winners (shared): Ann, Bob with 100 points");
  });

  it("starts afresh when the room returns to the lobby", () => {
    const { narrator, state } = setup();
    state.phase = PHASE.MatchupReveal;
    state.roundNumber = 1;
    state.matchups.push(revealed());
    expect(narrator.update(state)).not.toEqual([]);
    state.phase = "Lobby";
    state.matchups.clear();
    narrator.update(state);
    state.phase = PHASE.MatchupReveal;
    state.matchups.push(revealed());
    expect(narrator.update(state)).not.toEqual([]);
  });

  describe("discrepancies", () => {
    it("is clear when every score is the sum of the reveals", () => {
      const { narrator, state } = setup();
      state.phase = PHASE.MatchupReveal;
      state.roundNumber = 1;
      state.matchups.push(revealed());
      narrator.update(state);
      state.scoreboard.push(row("p1", "Ann", 250), row("p2", "Bob", 100));
      expect(narrator.discrepancies(state)).toEqual([]);
    });

    it("names the player whose score differs", () => {
      const { narrator, state } = setup();
      state.scoreboard.push(row("p1", "Ann", 5));
      expect(narrator.discrepancies(state)).toEqual([
        "Ann: scoreboard says 5, the reveals add up to 0",
      ]);
    });

    it("fails an empty scoreboard", () => {
      expect(setup().narrator.discrepancies(new WitClashState())).toEqual([
        "The scoreboard is empty",
      ]);
    });
  });
});
