import type { ActionLogEntry } from "@partygame/core";
import { describe, expect, it } from "vitest";
import { fastestAnswer, formatMs, mostVotesReceived, votesDetail } from "../../src/awards.js";
import type { AnswerRecord } from "../../src/bestAnswers.js";
import { WitClashPrivate } from "../../src/private.js";
import { makeCategories, Table } from "./support.js";

const repo = makeCategories();

describe("award detail lines", () => {
  it("formats milliseconds and seconds", () => {
    expect(formatMs(850)).toBe("850 ms");
    expect(formatMs(1234)).toBe("1.2 s");
  });

  it("pluralises votes", () => {
    expect(votesDetail(1)).toBe("1 vote");
    expect(votesDetail(3)).toBe("3 votes");
  });
});

const submit = (seq: number, t: number, senderId?: string): ActionLogEntry => ({
  seq,
  t,
  phase: "Prompting",
  kind: "action",
  actionType: "SUBMIT_ANSWER",
  ...(senderId === undefined ? {} : { senderId }),
});

const mark = (seq: number, t: number, kind: "enter" | "timeout"): ActionLogEntry => ({
  seq,
  t,
  phase: "Prompting",
  kind,
});

describe("fastestAnswer", () => {
  it("keeps the smallest delta per player across answer windows", () => {
    const scores = fastestAnswer.reduce(
      [
        mark(1, 0, "enter"),
        submit(2, 5000, "p1"),
        mark(3, 9000, "enter"),
        submit(4, 11000, "p1"),
        submit(5, 13000, "p1"),
        submit(6, 12000, "p2"),
      ],
      [],
    );
    expect(scores).toEqual(
      new Map([
        ["p1", 2000],
        ["p2", 3000],
      ]),
    );
  });

  it("ignores actions before any enter, other kinds and other action types", () => {
    const scores = fastestAnswer.reduce(
      [
        submit(1, 500, "p1"),
        mark(2, 1000, "enter"),
        mark(3, 2000, "timeout"),
        {
          seq: 4,
          t: 3000,
          phase: "Prompting",
          kind: "action" as const,
          actionType: "CAST_VOTE",
          senderId: "p1",
        },
        submit(5, 4000),
        submit(6, 5000, "p1"),
      ],
      [],
    );
    expect(scores).toEqual(new Map([["p1", 4000]]));
  });
});

const record = (authorId: string, votes: number): AnswerRecord => ({
  text: "an answer",
  authorId,
  authorName: authorId,
  promptText: "Q",
  votes,
  matchupVotes: 2,
});

describe("mostVotesReceived", () => {
  it("sums the votes each author received across the game", () => {
    const priv = new WitClashPrivate(repo, repo);
    for (const r of [record("p1", 3), record("p2", 1), record("p1", 2)]) priv.answerHistory.push(r);
    expect(mostVotesReceived(priv).reduce([], [])).toEqual(
      new Map([
        ["p1", 5],
        ["p2", 1],
      ]),
    );
  });

  it("has no data when nothing was recorded", () => {
    expect(mostVotesReceived(new WitClashPrivate(repo, repo)).reduce([], [])).toEqual(new Map());
  });
});

describe("the results ceremony", () => {
  const plain = (t: Table) =>
    [...t.state.awards].map((a) => ({
      id: a.id,
      title: a.title,
      winnerNames: [...a.winnerNames],
      detail: a.detail,
    }));

  it("writes both awards with winner names and detail lines at the final results", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toPrompting();
    t.tick(1234);
    t.answerEverything();
    t.playOutVoting();
    expect(t.phase).toBe("Results");
    expect(plain(t)).toEqual([
      {
        id: "fastest-answer",
        title: "Fastest answer",
        winnerNames: ["p1", "p2", "p3", "p4"],
        detail: "1.2 s",
      },
      {
        id: "most-votes-received",
        title: "Most votes received",
        winnerNames: ["p3"],
        detail: "4 votes",
      },
    ]);
  });

  it("omits an award with no data, keeping the ones that have some", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toPrompting();
    t.tick(850);
    const first = t.mine("p1").prompts[0] as { matchupId: string };
    t.act("p1", "SUBMIT_ANSWER", { matchupId: first.matchupId, answer: "alone" });
    t.tick(90_000);
    t.tick(20_000);
    t.tick(5_000);
    expect(t.phase).toBe("Results");
    expect(plain(t)).toEqual([
      { id: "fastest-answer", title: "Fastest answer", winnerNames: ["p1"], detail: "850 ms" },
    ]);
  });

  it("omits the whole ceremony when nobody answered", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toPrompting();
    t.tick(90_000);
    expect(t.phase).toBe("Results");
    expect(plain(t)).toEqual([]);
  });

  it("clears the awards when a new game starts", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toPrompting();
    t.tick(850);
    const first = t.mine("p1").prompts[0] as { matchupId: string };
    t.act("p1", "SUBMIT_ANSWER", { matchupId: first.matchupId, answer: "alone" });
    t.tick(90_000);
    t.tick(20_000);
    t.tick(5_000);
    expect([...t.state.awards]).toHaveLength(1);
    t.act("p1", "PLAY_AGAIN");
    expect(t.phase).toBe("Lobby");
    expect([...t.state.awards]).toHaveLength(0);
  });
});
