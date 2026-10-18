import { describe, expect, it } from "vitest";
import {
  allHaveVoted,
  countVoted,
  eligibleVoters,
  leaders,
  tallyVotes,
} from "../../src/kits/voteAndTally.js";

const votes = new Map([
  ["a", "x"],
  ["b", "x"],
  ["c", "y"],
]);

describe("tallyVotes", () => {
  it("counts only the given voters", () => {
    expect(tallyVotes(["a", "c", "z"], votes)).toEqual(
      new Map([
        ["x", 1],
        ["y", 1],
      ]),
    );
  });
});

describe("allHaveVoted", () => {
  it("knows when every voter has voted, and never for nobody", () => {
    expect(allHaveVoted(["a", "b"], votes)).toBe(true);
    expect(allHaveVoted(["a", "z"], votes)).toBe(false);
    expect(allHaveVoted([], votes)).toBe(false);
  });
});

describe("countVoted", () => {
  it("counts who has voted", () => {
    expect(countVoted(["a", "z", "c"], votes)).toBe(2);
  });
});

describe("eligibleVoters", () => {
  it("excludes the listed players", () => {
    expect(eligibleVoters(["a", "b", "c", "d"], ["a", "b"])).toEqual(["c", "d"]);
  });

  it("allows self-vote when nobody is excluded", () => {
    expect(eligibleVoters(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("is empty when everyone is excluded", () => {
    expect(eligibleVoters(["a", "b"], ["a", "b"])).toEqual([]);
  });
});

describe("leaders", () => {
  it("returns the highest count and everyone who shares it", () => {
    expect(
      leaders(
        new Map([
          ["a", 3],
          ["b", 3],
          ["c", 1],
        ]),
      ),
    ).toEqual({ top: 3, ids: ["a", "b"] });
  });

  it("keeps map order among ties and reports a single leader", () => {
    expect(
      leaders(
        new Map([
          ["a", 1],
          ["b", 2],
          ["c", 2],
        ]),
      ),
    ).toEqual({ top: 2, ids: ["b", "c"] });
  });

  it("has no leaders for an empty count", () => {
    expect(leaders(new Map())).toEqual({ top: -Infinity, ids: [] });
  });
});
