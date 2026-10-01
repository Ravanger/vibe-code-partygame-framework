import { describe, expect, it } from "vitest";
import { resolveCategoryVote } from "../../src/categoryVote.js";
import { Table } from "./support.js";

const started = (players = 4) => {
  const t = new Table({ players });
  t.start();
  return t;
};

describe("entering CategorySelection", () => {
  it("waits in the Lobby until the host presses Start", () => {
    const t = new Table({ players: 3 });
    t.runtime.rosterChanged();
    expect(t.phase).toBe("Lobby");
    expect(t.state.canStart).toBe(true);
    t.start();
    expect(t.phase).toBe("CategorySelection");
    expect(t.state.canStart).toBe(false);
  });

  it("publishes canStart false below minPlayers", () => {
    expect(new Table({ players: 2 }).state.canStart).toBe(false);
  });

  it("deals three distinct categories and numbers the round", () => {
    const t = started();
    const ids = [...t.state.categoryOptions].map((o) => o.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(t.state.roundNumber).toBe(1);
    expect(t.state.totalRounds).toBe(3);
    expect(t.state.selectedCategory).toBe("");
  });

  it("sets the deadline from the voting option and publishes round count from options", () => {
    const t = new Table({ options: { categoryVoteSeconds: 30, totalRounds: 5 } });
    t.start();
    expect(t.state.phaseEndsAt - t.host.time).toBe(30_000);
    expect(t.state.totalRounds).toBe(5);
  });

  it("gives every active player a private entry shown only to them", () => {
    const t = started();
    expect([...t.state.mine.keys()].sort()).toEqual(["p1", "p2", "p3", "p4"]);
    const shown = t.host.views.filter((v) => v.op === "show");
    expect(shown.map((v) => v.playerId).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    for (const view of shown) expect(view.ref).toBe(t.mine(view.playerId));
  });

  it("activates mid-game joiners", () => {
    const t = new Table({ players: 3 });
    t.start();
    expect(t.host.activations).toBe(1);
  });
});

describe("VOTE_CATEGORY", () => {
  it("tallies publicly and records who voted what only in the voter's own entry", () => {
    const t = started();
    const [first, second] = [...t.state.categoryOptions].map((o) => o.id);
    t.act("p1", "VOTE_CATEGORY", { categoryId: first });
    t.act("p2", "VOTE_CATEGORY", { categoryId: first });
    t.act("p3", "VOTE_CATEGORY", { categoryId: second });
    expect([...t.state.categoryOptions].map((o) => o.votes)).toEqual([2, 1, 0]);
    expect(t.mine("p1").categoryVote).toBe(first);
    expect(t.mine("p3").categoryVote).toBe(second);
    expect(t.mine("p4").categoryVote).toBe("");
    expect(JSON.stringify(t.state.categoryOptions.toJSON())).not.toContain("p1");
  });

  it("publishes how many of how many have voted", () => {
    const t = started();
    const [first, second] = [...t.state.categoryOptions].map((o) => o.id);
    expect([t.state.votesCast, t.state.votesExpected]).toEqual([0, 4]);
    t.act("p1", "VOTE_CATEGORY", { categoryId: first });
    t.act("p2", "VOTE_CATEGORY", { categoryId: first });
    t.act("p2", "VOTE_CATEGORY", { categoryId: second });
    expect([t.state.votesCast, t.state.votesExpected]).toEqual([2, 4]);
    t.drop("p4");
    expect([t.state.votesCast, t.state.votesExpected]).toEqual([2, 3]);
    t.leave("p2");
    expect([t.state.votesCast, t.state.votesExpected]).toEqual([1, 2]);
  });

  it("lets a player change their vote without double counting", () => {
    const t = started();
    const [first, second] = [...t.state.categoryOptions].map((o) => o.id);
    t.act("p1", "VOTE_CATEGORY", { categoryId: first });
    t.act("p1", "VOTE_CATEGORY", { categoryId: second });
    expect([...t.state.categoryOptions].map((o) => o.votes)).toEqual([0, 1, 0]);
    expect(t.mine("p1").categoryVote).toBe(second);
  });

  it("rejects an unknown category", () => {
    const t = started();
    t.act("p1", "VOTE_CATEGORY", { categoryId: "nope" });
    expect(t.errors("p1")).toMatchObject([{ code: "INVALID_ACTION" }]);
  });

  it("rejects a player who has not chosen a name", () => {
    const t = started();
    const seat = t.host.seats[3];
    if (seat) seat.isReady = false;
    t.act("p4", "VOTE_CATEGORY", { categoryId: t.state.categoryOptions[0]?.id });
    expect(t.errors("p4")).toMatchObject([{ code: "NOT_ALLOWED" }]);
  });

  it("resolves early once every connected active player has voted", () => {
    const t = started();
    const id = t.voteFirstCategory();
    expect(t.phase).toBe("Prompting");
    expect(t.state.selectedCategory).toBe(id);
    expect(t.priv.categoryId).toBe(id);
  });

  it("resolves at the deadline even if nobody voted", () => {
    const t = started();
    t.tick(60_000);
    expect(t.phase).toBe("Prompting");
    expect(t.state.selectedCategory).not.toBe("");
  });

  it("breaks ties only among the joint leaders", () => {
    const t = started();
    t.host.rng = () => 0.99;
    const [first, second] = [...t.state.categoryOptions].map((o) => o.id);
    t.act("p1", "VOTE_CATEGORY", { categoryId: first });
    t.act("p2", "VOTE_CATEGORY", { categoryId: second });
    t.act("p3", "VOTE_CATEGORY", { categoryId: second });
    t.act("p4", "VOTE_CATEGORY", { categoryId: first });
    expect(t.state.selectedCategory).toBe(second);
  });

  it("does not wait for a disconnected player", () => {
    const t = started();
    t.drop("p4");
    const id = t.state.categoryOptions[0]?.id;
    for (const p of ["p1", "p2", "p3"]) t.act(p, "VOTE_CATEGORY", { categoryId: id });
    expect(t.phase).toBe("Prompting");
  });

  it("resolves at once when the last pending voter leaves", () => {
    const t = started();
    const id = t.state.categoryOptions[0]?.id;
    for (const p of ["p1", "p2", "p3"]) t.act(p, "VOTE_CATEGORY", { categoryId: id });
    expect(t.phase).toBe("CategorySelection");
    t.leave("p4");
    expect(t.phase).toBe("Prompting");
    expect(t.state.mine.has("p4")).toBe(false);
  });

  it("hides a leaver's private entry before deleting it", () => {
    const t = started();
    const entry = t.mine("p4");
    t.leave("p4");
    expect(t.host.views).toContainEqual(
      expect.objectContaining({ op: "hide", playerId: "p4", ref: entry }),
    );
  });

  it("stops counting the vote of a player who left", () => {
    const t = started();
    const [first, second] = [t.state.categoryOptions[0]?.id, t.state.categoryOptions[1]?.id];
    t.act("p1", "VOTE_CATEGORY", { categoryId: first });
    t.act("p2", "VOTE_CATEGORY", { categoryId: second });
    t.act("p3", "VOTE_CATEGORY", { categoryId: second });
    expect(t.state.categoryOptions[1]?.votes).toBe(2);
    t.leave("p2");
    expect(t.state.categoryOptions[1]?.votes).toBe(1);
    expect(t.state.votesCast).toBe(2);
    expect(t.state.votesExpected).toBe(3);
  });

  it("stops counting the vote of a player who dropped", () => {
    const t = started();
    const id = t.state.categoryOptions[0]?.id;
    t.act("p1", "VOTE_CATEGORY", { categoryId: id });
    t.drop("p1");
    expect(t.state.categoryOptions[0]?.votes).toBe(0);
  });

  it("ignores votes that arrive after resolution", () => {
    const t = started();
    t.voteFirstCategory();
    t.act("p1", "VOTE_CATEGORY", { categoryId: "cat-0" });
    expect(t.errors("p1")).toMatchObject([{ code: "WRONG_PHASE" }]);
  });

  it("does not resolve with nobody left to vote", () => {
    const t = started(3);
    for (const p of ["p1", "p2", "p3"]) t.drop(p);
    expect(t.phase).toBe("CategorySelection");
  });
});

describe("resolveCategoryVote", () => {
  const options = [
    { id: "a", votes: 1 },
    { id: "b", votes: 3 },
    { id: "c", votes: 3 },
  ];

  it("returns the clear plurality winner", () => {
    expect(
      resolveCategoryVote(
        [
          { id: "a", votes: 5 },
          { id: "b", votes: 1 },
        ],
        () => 0.9,
      ),
    ).toBe("a");
  });

  it("breaks a tie only among the leaders", () => {
    expect(resolveCategoryVote(options, () => 0)).toBe("b");
    expect(resolveCategoryVote(options, () => 0.99)).toBe("c");
  });

  it("picks at random when nobody voted", () => {
    const none = options.map((o) => ({ ...o, votes: 0 }));
    expect(resolveCategoryVote(none, () => 0.7)).toBe("c");
  });

  it("throws on an empty option list", () => {
    expect(() => resolveCategoryVote([], () => 0)).toThrow(/no options/);
  });
});
