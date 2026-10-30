import { describe, expect, it } from "vitest";
import type { AnswerRecord } from "../../src/bestAnswers.js";
import { pickHighlights } from "../../src/highlights.js";

const record = (
  over: Partial<AnswerRecord> & Pick<AnswerRecord, "matchupId" | "votes">,
): AnswerRecord => ({
  text: "an answer",
  authorId: "p1",
  authorName: "P1",
  promptText: "The prompt?",
  matchupVotes: 2,
  answerMs: 1000,
  ...over,
});

/** A two-answer contest; `ms` is each answer's submission time (defined when omitted). */
const contest = (
  matchupId: string,
  promptText: string,
  votes: [number, number],
  ms?: [number, number],
): AnswerRecord[] => [
  record({
    matchupId,
    promptText,
    authorId: "a",
    authorName: "A",
    text: "from A",
    votes: votes[0],
    ...(ms !== undefined ? { answerMs: ms[0] } : {}),
  }),
  record({
    matchupId,
    promptText,
    authorId: "b",
    authorName: "B",
    text: "from B",
    votes: votes[1],
    ...(ms !== undefined ? { answerMs: ms[1] } : {}),
  }),
];

describe("pickHighlights", () => {
  it("returns nothing for an empty history", () => {
    expect(pickHighlights([])).toEqual({});
  });

  it("flags the matchup with the largest vote margin, showing its whole contest", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [2, 0]),
      ...contest("m2", "P2?", [3, 0]),
    ]);
    expect(picked.biggestMargin).toEqual([
      {
        kind: "biggestMargin",
        promptText: "P2?",
        answers: [
          { authorName: "A", text: "from A", votes: 3 },
          { authorName: "B", text: "from B", votes: 0 },
        ],
      },
    ]);
  });

  it("shares the biggest margin when two matchups tie, in history order", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [3, 0]),
      ...contest("m2", "P2?", [4, 1]),
    ]);
    expect(picked.biggestMargin?.map((h) => h.promptText)).toEqual(["P1?", "P2?"]);
  });

  it("has no biggest margin when every contest is level, but the closest match is", () => {
    const picked = pickHighlights(contest("m1", "P1?", [2, 2]));
    expect(picked.biggestMargin).toBeUndefined();
    expect(picked.closestMatch?.map((h) => h.promptText)).toEqual(["P1?"]);
  });

  it("flags the smallest gap among voted matchups", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [3, 1]),
      ...contest("m2", "P2?", [2, 1]),
    ]);
    expect(picked.closestMatch?.map((h) => h.promptText)).toEqual(["P2?"]);
  });

  it("shares the closest match when two matchups tie on the gap", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [3, 1]),
      ...contest("m2", "P2?", [5, 3]),
    ]);
    expect(picked.closestMatch?.map((h) => h.promptText)).toEqual(["P1?", "P2?"]);
  });

  it("ignores a matchup with no votes for the margin and the closest match", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [0, 0]),
      ...contest("m2", "P2?", [1, 1]),
    ]);
    expect(picked.biggestMargin).toBeUndefined();
    expect(picked.closestMatch?.map((h) => h.promptText)).toEqual(["P2?"]);
  });

  it("has no margin or closest match when nothing was voted", () => {
    const picked = pickHighlights(contest("m1", "P1?", [0, 0]));
    expect(picked.biggestMargin).toBeUndefined();
    expect(picked.closestMatch).toBeUndefined();
  });

  it("flags the fastest answer that got a vote", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [1, 0], [500, 900]),
      ...contest("m2", "P2?", [0, 1], [700, 300]),
    ]);
    expect(picked.fastestAnswer).toEqual([
      {
        kind: "fastestAnswer",
        promptText: "P2?",
        answers: [{ authorName: "B", text: "from B", votes: 1 }],
      },
    ]);
  });

  it("never highlights an answer that got no vote, however fast", () => {
    const picked = pickHighlights(contest("m1", "P1?", [0, 1], [500, 300]));
    expect(picked.fastestAnswer?.[0]?.answers.map((a) => a.authorName)).toEqual(["B"]);
  });

  it("shares the fastest answer across tied submissions in different matchups", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [1, 0], [300, 900]),
      ...contest("m2", "P2?", [0, 1], [800, 300]),
    ]);
    expect(picked.fastestAnswer?.map((h) => h.promptText)).toEqual(["P1?", "P2?"]);
    expect(picked.fastestAnswer?.map((h) => h.answers.map((a) => a.authorName))).toEqual([
      ["A"],
      ["B"],
    ]);
  });

  it("lists every tied fastest answer of one matchup together", () => {
    const picked = pickHighlights(contest("m1", "P1?", [1, 1], [300, 300]));
    expect(picked.fastestAnswer).toEqual([
      {
        kind: "fastestAnswer",
        promptText: "P1?",
        answers: [
          { authorName: "A", text: "from A", votes: 1 },
          { authorName: "B", text: "from B", votes: 1 },
        ],
      },
    ]);
  });

  it("never highlights a placeholder answer, even when it wins the vote", () => {
    const picked = pickHighlights([
      record({
        matchupId: "m1",
        authorId: "a",
        text: "(no answer)",
        votes: 3,
        answerMs: undefined,
      }),
      record({ matchupId: "m1", authorId: "b", text: "from B", votes: 0, answerMs: 100 }),
    ]);
    expect(picked.biggestMargin).toBeUndefined();
    expect(picked.closestMatch).toBeUndefined();
    expect(picked.fastestAnswer).toBeUndefined();
  });

  it("skips a whole matchup for the margin and closest when any of its answers is a placeholder", () => {
    const picked = pickHighlights([
      ...contest("m1", "P1?", [3, 0]),
      record({
        matchupId: "m2",
        promptText: "P2?",
        authorId: "c",
        text: "(no answer)",
        votes: 4,
        answerMs: undefined,
      }),
      record({
        matchupId: "m2",
        promptText: "P2?",
        authorId: "d",
        text: "from D",
        votes: 0,
        answerMs: 100,
      }),
    ]);
    expect(picked.biggestMargin?.map((h) => h.promptText)).toEqual(["P1?"]);
    expect(picked.closestMatch?.map((h) => h.promptText)).toEqual(["P1?"]);
    expect(picked.fastestAnswer?.map((h) => h.promptText)).toEqual(["P1?"]);
  });

  it("skips a one-record group for margin and closest, but still highlights its fastest answer", () => {
    const picked = pickHighlights([
      record({
        matchupId: "m1",
        authorId: "a",
        authorName: "A",
        text: "from A",
        votes: 2,
        answerMs: 300,
      }),
    ]);
    expect(picked.biggestMargin).toBeUndefined();
    expect(picked.closestMatch).toBeUndefined();
    expect(picked.fastestAnswer).toEqual([
      {
        kind: "fastestAnswer",
        promptText: "The prompt?",
        answers: [{ authorName: "A", text: "from A", votes: 2 }],
      },
    ]);
  });
});
