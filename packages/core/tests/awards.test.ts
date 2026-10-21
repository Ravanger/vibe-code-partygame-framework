import { describe, expect, it } from "vitest";
import type { ActionLog, ActionLogEntry, RosterSeat } from "../src/actionLog.js";
import { type AwardDefinition, computeAwards } from "../src/awards/index.js";

const seat = (id: string): RosterSeat => ({ id, isConnected: true, isReady: true, isActive: true });

const logOf = (entries: ActionLogEntry[], roster?: RosterSeat[]): ActionLog => ({
  header: { seed: [1, 2, 3, 4], game: "TestGame", startedAt: 0 },
  ...(roster === undefined ? {} : { roster }),
  entries,
});

const enter = (seq: number, t: number, phase: string): ActionLogEntry => ({
  seq,
  t,
  phase,
  kind: "enter",
});

const submit = (seq: number, t: number, senderId: string, rejected = false): ActionLogEntry => ({
  seq,
  t,
  phase: "Round",
  kind: "action",
  actionType: "SUBMIT",
  senderId,
  ...(rejected ? { rejected: true } : {}),
});

/** Counts accepted SUBMITs per sender (the default higherIsBetter). */
const mostSubmits: AwardDefinition = {
  id: "most-submits",
  title: "Most submits",
  reduce(entries) {
    const scores = new Map<string, number>();
    for (const entry of entries) {
      if (entry.kind !== "action" || entry.actionType !== "SUBMIT" || entry.senderId === undefined)
        continue;
      scores.set(entry.senderId, (scores.get(entry.senderId) ?? 0) + 1);
    }
    return scores;
  },
};

/** Scores every distinct submitter equally — a built-in tie. */
const allSubmitters: AwardDefinition = {
  id: "all-submitters",
  title: "All submitters",
  reduce(entries) {
    const scores = new Map<string, number>();
    for (const entry of entries) {
      if (entry.kind === "action" && entry.senderId !== undefined) scores.set(entry.senderId, 1);
    }
    return scores;
  },
};

/** The documented example: the smallest t delta between a phase enter and the player's first SUBMIT in it. */
const fastestAnswer: AwardDefinition = {
  id: "fastest-answer",
  title: "Fastest answer",
  higherIsBetter: false,
  reduce(entries) {
    const scores = new Map<string, number>();
    let windowStart: number | undefined;
    let answered = new Set<string>();
    for (const entry of entries) {
      if (entry.kind === "enter") {
        windowStart = entry.t;
        answered = new Set();
        continue;
      }
      if (entry.kind !== "action" || entry.actionType !== "SUBMIT" || entry.senderId === undefined)
        continue;
      if (windowStart !== undefined && !answered.has(entry.senderId)) {
        scores.set(entry.senderId, entry.t - windowStart);
        answered.add(entry.senderId);
      }
    }
    return scores;
  },
};

describe("computeAwards", () => {
  it("scores players and awards the best score (higherIsBetter defaults to true)", () => {
    const log = logOf([
      enter(1, 0, "Lobby"),
      enter(2, 100, "Round"),
      submit(3, 200, "p1"),
      submit(4, 300, "p2"),
      submit(5, 400, "p1"),
    ]);
    expect(computeAwards(log, [mostSubmits])).toEqual([
      {
        id: "most-submits",
        title: "Most submits",
        scores: new Map([
          ["p1", 2],
          ["p2", 1],
        ]),
        winners: ["p1"],
      },
    ]);
  });

  it("shares the win on a tie, in score-map order", () => {
    const log = logOf([enter(1, 0, "Lobby"), submit(2, 100, "p1"), submit(3, 200, "p2")]);
    expect(computeAwards(log, [allSubmitters])).toEqual([
      {
        id: "all-submitters",
        title: "All submitters",
        scores: new Map([
          ["p1", 1],
          ["p2", 1],
        ]),
        winners: ["p1", "p2"],
      },
    ]);
  });

  it("awards the lowest score when higherIsBetter is false", () => {
    const log = logOf([
      enter(1, 0, "Lobby"),
      enter(2, 100, "Round"),
      submit(3, 400, "p1"),
      submit(4, 300, "p2"),
      submit(5, 200, "p3"),
    ]);
    expect(computeAwards(log, [fastestAnswer])).toEqual([
      {
        id: "fastest-answer",
        title: "Fastest answer",
        scores: new Map([
          ["p1", 300],
          ["p2", 200],
          ["p3", 100],
        ]),
        winners: ["p3"],
      },
    ]);
  });

  it("returns no winner for an award with no data", () => {
    const log = logOf([enter(1, 0, "Lobby")]);
    expect(computeAwards(log, [mostSubmits])).toEqual([
      { id: "most-submits", title: "Most submits", scores: new Map(), winners: [] },
    ]);
  });

  it("filters rejected entries before the reducers run", () => {
    const log = logOf([
      enter(1, 0, "Lobby"),
      submit(2, 100, "p1"),
      submit(3, 200, "p1", true),
      submit(4, 300, "p2", true),
    ]);
    expect(computeAwards(log, [mostSubmits])).toEqual([
      {
        id: "most-submits",
        title: "Most submits",
        scores: new Map([["p1", 1]]),
        winners: ["p1"],
      },
    ]);
  });

  it("passes the recorded roster to reducers, and an empty array when the log has none", () => {
    const seen: Array<readonly RosterSeat[]> = [];
    const spy: AwardDefinition = {
      id: "spy",
      title: "Spy",
      reduce(_entries, roster) {
        seen.push(roster);
        return new Map<string, number>();
      },
    };
    const roster = [seat("p1"), seat("p2")];
    computeAwards(logOf([enter(1, 0, "Lobby")], roster), [spy]);
    computeAwards(logOf([enter(1, 0, "Lobby")]), [spy]);
    expect(seen).toEqual([roster, []]);
  });

  it("computes each declared award in declaration order", () => {
    const log = logOf([enter(1, 0, "Lobby"), submit(2, 100, "p1")]);
    const results = computeAwards(log, [mostSubmits, allSubmitters]);
    expect(results.map((result) => result.id)).toEqual(["most-submits", "all-submitters"]);
  });

  it("example: fastest answer is the first SUBMIT after a phase enter, ignoring later ones", () => {
    const log = logOf([
      enter(1, 0, "Lobby"),
      enter(2, 100, "Round"),
      submit(3, 250, "p2"),
      submit(4, 400, "p1"),
      submit(5, 500, "p2"), // p2 already answered in this window
    ]);
    expect(computeAwards(log, [fastestAnswer])).toEqual([
      {
        id: "fastest-answer",
        title: "Fastest answer",
        scores: new Map([
          ["p2", 150],
          ["p1", 300],
        ]),
        winners: ["p2"],
      },
    ]);
  });
});
