import { describe, expect, it } from "vitest";
import { ACTION } from "../../src/actions.js";
import { allAnswered, classifyMatchup, draftsFor } from "../../src/drafts.js";
import { eligibleVoterIds } from "../../src/eligibility.js";
import { DEFAULT_OPTIONS } from "../../src/options.js";
import { PHASE } from "../../src/phaseNames.js";
import { pickPromptPool } from "../../src/promptPool.js";
import { composeScoreboard } from "../../src/scoreboard.js";
import { forfeitAward, settleMatchup } from "../../src/scoring.js";
import { allHaveVoted, countVoted, tallyVotes } from "../../src/tally.js";

describe("eligibleVoterIds", () => {
  it("excludes the authors", () => {
    expect(eligibleVoterIds(["a", "b", "c", "d"], ["a", "b"], false)).toEqual(["c", "d"]);
  });

  it("is empty for a forfeit", () => {
    expect(eligibleVoterIds(["a", "b", "c"], ["a"], true)).toEqual([]);
  });

  it("is empty when everyone wrote an answer", () => {
    expect(eligibleVoterIds(["a", "b"], ["a", "b"], false)).toEqual([]);
  });
});

describe("tally", () => {
  const votes = new Map([
    ["a", "x"],
    ["b", "x"],
    ["c", "y"],
  ]);

  it("counts only the given voters", () => {
    expect(tallyVotes(["a", "c", "z"], votes)).toEqual(
      new Map([
        ["x", 1],
        ["y", 1],
      ]),
    );
  });

  it("knows when every voter has voted, and never for nobody", () => {
    expect(allHaveVoted(["a", "b"], votes)).toBe(true);
    expect(allHaveVoted(["a", "z"], votes)).toBe(false);
    expect(allHaveVoted([], votes)).toBe(false);
  });

  it("counts who has voted", () => {
    expect(countVoted(["a", "z", "c"], votes)).toBe(2);
  });
});

describe("pickPromptPool", () => {
  const prompts = ["p1", "p2", "p3", "p4"].map((id) => ({ id, text: id }));

  it("offers only unused prompts while enough remain", () => {
    expect(pickPromptPool(prompts, new Set(["p1"]), 3)).toEqual({
      prompts: prompts.slice(1),
      exhausted: false,
    });
  });

  it("falls back to the whole category when too few are left", () => {
    expect(pickPromptPool(prompts, new Set(["p1", "p2"]), 3)).toEqual({ prompts, exhausted: true });
  });
});

describe("drafts", () => {
  const assignments = new Map([
    ["a", ["m1", "m2"]],
    ["b", ["m1"]],
  ]);
  const drafts = new Map([
    ["a", new Map([["m1", "hi"]])],
    ["b", new Map([["m1", "yo"]])],
  ]);

  it("lists the authors of a matchup with their text or lack of it", () => {
    expect(draftsFor("m1", assignments, drafts)).toEqual([
      { playerId: "a", text: "hi" },
      { playerId: "b", text: "yo" },
    ]);
    expect(draftsFor("m2", assignments, drafts)).toEqual([{ playerId: "a", text: undefined }]);
  });

  it("is complete only when every assignment has a draft", () => {
    const present = new Set(["a", "b"]);
    expect(allAnswered(assignments, drafts, present)).toBe(false);
    drafts.get("a")?.set("m2", "late");
    expect(allAnswered(assignments, drafts, present)).toBe(true);
    expect(allAnswered(new Map(), new Map(), present)).toBe(false);
  });

  it("does not wait for absent authors, and never completes with nobody present", () => {
    const pending = new Map([["a", new Map([["m1", "hi"]])]]);
    expect(allAnswered(assignments, pending, new Set(["a"]))).toBe(false);
    expect(allAnswered(assignments, pending, new Set(["b"]))).toBe(false);
    expect(allAnswered(new Map([["b", ["m1"]]]), drafts, new Set(["a", "b"]))).toBe(true);
    expect(allAnswered(assignments, drafts, new Set(["c"]))).toBe(false);
    expect(allAnswered(assignments, drafts, new Set())).toBe(false);
  });

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
    expect(Object.keys(PHASE)).toHaveLength(8);
    expect(Object.keys(ACTION)).toEqual(Object.values(ACTION));
    expect(Object.keys(PHASE)).toEqual(Object.values(PHASE));
  });

  it("derives the default options from the schema", () => {
    expect(DEFAULT_OPTIONS.totalRounds).toBe(3);
  });
});
