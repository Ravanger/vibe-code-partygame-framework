import { describe, expect, it } from "vitest";
import { ACTION } from "../../src/actions.js";
import { classifyMatchup } from "../../src/drafts.js";
import { eligibleVoterIds } from "../../src/eligibility.js";
import { DEFAULT_OPTIONS } from "../../src/options.js";
import { PHASE } from "../../src/phaseNames.js";
import { composeScoreboard } from "../../src/scoreboard.js";
import { forfeitAward, settleMatchup } from "../../src/scoring.js";

describe("eligibleVoterIds", () => {
  it("is empty for a forfeit", () => {
    expect(eligibleVoterIds(["a", "b", "c"], ["a"], true)).toEqual([]);
  });
});

describe("classifyMatchup", () => {
  it("classifies matchups by how many real answers they have", () => {
    const real = { playerId: "a", text: "x" };
    const blank = { playerId: "b", text: undefined };
    expect(classifyMatchup([real, real])).toBe("contested");
    expect(classifyMatchup([real, blank])).toBe("forfeit");
    expect(classifyMatchup([real])).toBe("forfeit");
    expect(classifyMatchup([blank])).toBe("skipped");
    expect(classifyMatchup([])).toBe("skipped");
  });
});

describe("settleMatchup", () => {
  const answers = [
    { id: "1", authorId: "a", votes: 0, isPlaceholder: false },
    { id: "2", authorId: "b", votes: 0, isPlaceholder: true },
  ];

  it("pays a forfeit to its only real author, with no vote points", () => {
    expect(settleMatchup(answers, true, 0)).toEqual([forfeitAward("a")]);
    expect(forfeitAward("a")).toMatchObject({
      votePoints: 0,
      bonusPoints: 50,
      total: 50,
      isWinner: true,
    });
  });

  it("scores by votes otherwise", () => {
    const voted = [
      { id: "1", authorId: "a", votes: 2, isPlaceholder: false },
      { id: "2", authorId: "b", votes: 0, isPlaceholder: false },
    ];
    expect(settleMatchup(voted, false, 2).map((a) => a.total)).toEqual([400, 0]);
  });
});

describe("composeScoreboard", () => {
  const award = {
    playerId: "a",
    votePoints: 100,
    bonusPoints: 50,
    total: 150,
    isWinner: true,
    isClash: true,
  };

  it("lists seated players best first, then leavers, flagging those who left", () => {
    const rows = composeScoreboard({
      scores: { a: 150, gone: 400 },
      awards: [award],
      tieBreakerWinnerId: "a",
      activeIds: ["a", "b"],
      participantIds: [],
      seatedNames: new Map([
        ["a", "Ann"],
        ["b", ""],
      ]),
      rememberedNames: { gone: "Gus" },
    });
    expect(rows).toEqual([
      {
        playerId: "a",
        name: "Ann",
        score: 150,
        roundPoints: 150,
        matchupsWon: 1,
        hadClash: true,
        wonTieBreaker: true,
        hasLeft: false,
      },
      {
        playerId: "b",
        name: "",
        score: 0,
        roundPoints: 0,
        matchupsWon: 0,
        hadClash: false,
        wonTieBreaker: false,
        hasLeft: false,
      },
      {
        playerId: "gone",
        name: "Gus",
        score: 400,
        roundPoints: 0,
        matchupsWon: 0,
        hadClash: false,
        wonTieBreaker: false,
        hasLeft: true,
      },
    ]);
  });

  it("keeps a leaver on zero points and ranks leavers below seated players", () => {
    const rows = composeScoreboard({
      scores: { gone: 900, a: 10 },
      awards: [],
      tieBreakerWinnerId: "",
      activeIds: ["a"],
      participantIds: ["zero", "a"],
      seatedNames: new Map([["a", "Ann"]]),
      rememberedNames: { gone: "Gus", zero: "Zed" },
    });
    expect(rows.map((r) => [r.playerId, r.score, r.hasLeft])).toEqual([
      ["a", 10, false],
      ["gone", 900, true],
      ["zero", 0, true],
    ]);
  });

  it("falls back to an empty name for someone never seen", () => {
    const [row] = composeScoreboard({
      scores: { x: 1 },
      awards: [],
      tieBreakerWinnerId: "",
      activeIds: [],
      participantIds: [],
      seatedNames: new Map(),
      rememberedNames: {},
    });
    expect(row?.name).toBe("");
  });
});

describe("shared names and defaults", () => {
  it("exposes every phase and action name", () => {
    expect(Object.keys(PHASE)).toHaveLength(9);
    expect(Object.keys(ACTION)).toEqual(Object.values(ACTION));
    expect(Object.keys(PHASE)).toEqual(Object.values(PHASE));
  });

  it("derives the default options from the schema", () => {
    expect(DEFAULT_OPTIONS.totalRounds).toBe(3);
  });
});
