import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const submitAll = (t: Table): void => {
  t.submitFake("p1", "Sydney");
  t.submitFake("p2", "Perth");
  t.submitFake("p3", "Brisbane");
  t.submitFake("p4", "Adelaide");
};

describe("Voting", () => {
  it("builds one option per submitted fake plus the truth, with no author info", () => {
    const t = Table.started();
    submitAll(t);
    expect(t.phase).toBe("Voting");
    expect(t.state.choices.length).toBe(5);
    const texts = t.state.choices.map((o) => o.text).sort();
    expect(texts).toEqual(["Adelaide", "Brisbane", "Canberra", "Perth", "Sydney"]);
    for (const option of t.state.choices) {
      expect(option.authorName).toBe("");
      expect(option.votes).toBe(0);
    }
  });

  it("omits the fake of a player who never submitted", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    t.tick(45_000);
    expect(t.phase).toBe("Voting");
    expect(t.state.choices.length).toBe(4);
  });

  it("shuffles options deterministically for the same seed", () => {
    const run = (seed: number) => {
      const t = Table.started({ seed });
      submitAll(t);
      return t.state.choices.map((o) => o.id).join("|");
    };
    expect(run(42)).toBe(run(42));
  });

  it("tracks the truth option privately and keeps authorship off the synced state", () => {
    const t = Table.started();
    submitAll(t);
    const truthOption = t.state.choices.find((o) => o.text === "Canberra");
    expect(truthOption?.id).toBe(t.priv.truthOptionId);
    expect(t.priv.optionAuthor.get(t.priv.truthOptionId)).toBe("");
    for (const option of t.state.choices) {
      expect(option.authorName).toBe("");
    }
  });

  it("shows each player only their own private entry, with their own option id", () => {
    const t = Table.started();
    submitAll(t);
    const shown = t.host.views.filter((v) => v.op === "show");
    expect(shown.map((v) => v.playerId).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    for (const view of shown) {
      expect(view.ref).toBe(t.state.mine.get(view.playerId));
    }
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      const own = t.state.choices.find((o) => t.priv.optionAuthor.get(o.id) === playerId);
      expect(t.state.mine.get(playerId)?.myOptionId).toBe(own?.id ?? "");
    }
  });

  it("gives a non-submitter an empty private entry", () => {
    const t = Table.started();
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    t.tick(45_000);
    expect(t.state.mine.get("p4")?.myOptionId).toBe("");
  });

  it("stores a vote and counts it", () => {
    const t = Table.started();
    submitAll(t);
    t.voteFor("p1", 0);
    expect(t.priv.votes.get("p1")).toBe(t.state.choices[0]?.id);
    expect(t.state.votesCast).toBe(1);
    expect(t.state.votesExpected).toBe(4);
  });

  it("rejects a vote for an unknown option", () => {
    const t = Table.started();
    submitAll(t);
    const error = t.act("p1", "CAST_VOTE", { optionId: "nope" });
    expect(error?.message).toBe("Unknown option");
  });

  it("rejects a vote for the player's own fake", () => {
    const t = Table.started();
    submitAll(t);
    const ownIndex = t.state.choices.findIndex((o) => t.priv.optionAuthor.get(o.id) === "p1");
    const error = t.act("p1", "CAST_VOTE", { optionId: t.state.choices[ownIndex]?.id ?? "" });
    expect(error?.message).toBe("You cannot vote for your own answer");
  });

  it("rejects a second vote from the same player", () => {
    const t = Table.started();
    submitAll(t);
    t.voteFor("p1", 0);
    const otherIndex = t.state.choices.findIndex((o) => o.id !== t.priv.votes.get("p1"));
    const error = t.act("p1", "CAST_VOTE", { optionId: t.state.choices[otherIndex]?.id ?? "" });
    expect(error?.message).toBe("You already voted");
  });

  it("moves to Reveal once every active player has voted", () => {
    const t = Table.started();
    submitAll(t);
    for (const voter of ["p1", "p2", "p3"]) {
      const index = t.state.choices.findIndex((o) => t.priv.optionAuthor.get(o.id) !== voter);
      t.act(voter, "CAST_VOTE", { optionId: t.state.choices[index]?.id ?? "" });
    }
    expect(t.phase).toBe("Voting");
    const last = t.state.choices.findIndex((o) => t.priv.optionAuthor.get(o.id) !== "p4");
    t.act("p4", "CAST_VOTE", { optionId: t.state.choices[last]?.id ?? "" });
    expect(t.phase).toBe("Reveal");
  });

  it("moves to Reveal on the timeout, keeping partial votes", () => {
    const t = Table.started();
    submitAll(t);
    t.voteFor("p1", 0);
    t.tick(30_000);
    expect(t.phase).toBe("Reveal");
    expect(t.priv.votes.size).toBe(1);
  });

  it("moves to Reveal when a departure completes the votes", () => {
    const t = Table.started();
    submitAll(t);
    for (const voter of ["p1", "p2", "p3"]) {
      const index = t.state.choices.findIndex((o) => t.priv.optionAuthor.get(o.id) !== voter);
      t.act(voter, "CAST_VOTE", { optionId: t.state.choices[index]?.id ?? "" });
    }
    expect(t.phase).toBe("Voting");
    t.leave("p4");
    expect(t.phase).toBe("Reveal");
  });

  it("drops a leaver's vote and re-counts the expectation", () => {
    const t = Table.started();
    submitAll(t);
    t.voteFor("p4", 0);
    t.leave("p4");
    expect(t.priv.votes.has("p4")).toBe(false);
    expect(t.state.votesExpected).toBe(3);
    expect(t.state.votesCast).toBe(0);
  });

  it("ends the game when a departure drops the room below the minimum", () => {
    const t = Table.started({ players: 3 });
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    t.leave("p3");
    expect(t.phase).toBe("Lobby");
    expect(t.state.notice).toBe("Fewer than 3 players were left, so the game ended.");
  });
});
