import { describe, expect, it } from "vitest";
import { podiumSteps, rankRows } from "../src/ranking.js";

const row = (name: string, score: number, hasLeft = false) => ({ name, score, hasLeft });

function podium(...scores: number[]) {
  return podiumSteps(rankRows(scores.map((score, index) => row(`P${index}`, score))));
}

describe("rankRows", () => {
  it("is empty for no rows", () => {
    expect(rankRows([])).toEqual([]);
  });
  it("gives tied scores a shared competition rank", () => {
    expect(
      rankRows([row("a", 9), row("b", 9), row("c", 5), row("d", 1)]).map((r) => r.rank),
    ).toEqual([1, 1, 3, 4]);
  });
  it("starts a new rank group where hasLeft changes", () => {
    expect(
      rankRows([row("a", 10), row("b", 10, true), row("c", 10, true)]).map((r) => [r.name, r.rank]),
    ).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
    ]);
  });
});

describe("podiumSteps", () => {
  it("is empty without rows", () => {
    expect(podium()).toEqual([]);
  });

  it("puts the winner in the middle, the runner-up on the left and third on the right", () => {
    const steps = podium(300, 200, 100, 50);
    expect(steps.map((s) => [s.rank, s.tier, s.label, s.players.map((p) => p.name)])).toEqual([
      [2, 2, "2nd", ["P1"]],
      [1, 1, "1st", ["P0"]],
      [3, 3, "3rd", ["P2"]],
    ]);
  });

  it("keeps leavers off the podium", () => {
    const rows = rankRows([row("A", 10), row("G", 10, true)]);
    expect(podiumSteps(rows).map((s) => s.players.map((p) => p.name))).toEqual([["A"]]);
  });

  it("shows a single player alone", () => {
    expect(podium(10).map((s) => s.label)).toEqual(["1st"]);
  });

  it("shows two players", () => {
    expect(podium(10, 5).map((s) => s.label)).toEqual(["2nd", "1st"]);
  });

  it("lets tied players share a step and gives the next tier the next step", () => {
    const steps = podium(300, 300, 100, 100);
    expect(steps.map((s) => [s.rank, s.tier, s.label, s.players.map((p) => p.name)])).toEqual([
      [3, 2, "2nd", ["P2", "P3"]],
      [1, 1, "1st", ["P0", "P1"]],
    ]);
  });

  it("fills three steps by tier and labels steps by tier, not competition rank", () => {
    const steps = podium(300, 300, 100, 50, 20);
    expect(steps.map((s) => [s.tier, s.label, s.players.length])).toEqual([
      [2, "2nd", 1],
      [1, "1st", 2],
      [3, "3rd", 1],
    ]);
  });
});
