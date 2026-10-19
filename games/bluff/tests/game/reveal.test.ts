import { describe, expect, it } from "vitest";
import { Table } from "./support.js";

const indexOf = (t: Table, text: string): number =>
  t.state.choices.findIndex((o) => o.text === text);

/** One full round: everyone submits a distinct fake, then votes in the fixed pattern below. */
const playRound = (t: Table): void => {
  t.submitFake("p1", "Sydney");
  t.submitFake("p2", "Perth");
  t.submitFake("p3", "Brisbane");
  t.submitFake("p4", "Adelaide");
  // p1 guesses the truth; p2 fools nobody's fake author but votes p3's; p3 votes p1's; p4 votes p2's.
  t.voteFor("p1", indexOf(t, "Canberra"));
  t.voteFor("p2", indexOf(t, "Brisbane"));
  t.voteFor("p3", indexOf(t, "Sydney"));
  t.voteFor("p4", indexOf(t, "Perth"));
};

describe("Reveal", () => {
  it("reveals the truth option and every author's name", () => {
    const t = Table.started();
    playRound(t);
    expect(t.phase).toBe("Reveal");
    const truthOption = t.state.choices.find((o) => o.id === t.state.truthRevealedId);
    expect(truthOption?.text).toBe("Canberra");
    expect(truthOption?.authorName).toBe("The game");
    for (const [name, text] of [
      ["p1", "Sydney"],
      ["p2", "Perth"],
      ["p3", "Brisbane"],
      ["p4", "Adelaide"],
    ]) {
      const option = t.state.choices.find((o) => o.text === text);
      expect(option?.authorName).toBe(name);
    }
  });

  it("writes the vote count of every option", () => {
    const t = Table.started();
    playRound(t);
    for (const [text, votes] of [
      ["Canberra", 1],
      ["Sydney", 1],
      ["Perth", 1],
      ["Brisbane", 1],
      ["Adelaide", 0],
    ] as const) {
      expect(t.state.choices.find((o) => o.text === text)?.votes).toBe(votes);
    }
  });

  it("awards the guesser and every fooled author", () => {
    const t = Table.started();
    playRound(t);
    // p1: +2 for guessing, +1 for fooling p3. p2: +1 (fooled by p4). p3: +1 (fooled by p2). p4: none.
    expect(t.priv.scores).toEqual({ p1: 3, p2: 1, p3: 1 });
    const entries = t.state.results.map((r) => r.playerId);
    expect(entries).toEqual(["p1", "p3", "p2"]);
    const p1 = t.state.results.find((r) => r.playerId === "p1");
    expect(p1?.roundPoints).toBe(3);
    expect(p1?.guessedTruth).toBe(true);
    expect(p1?.fooledCount).toBe(1);
  });

  it("writes the scoreboard with seated players ranked", () => {
    const t = Table.started();
    playRound(t);
    expect(t.state.scoreboard.map((s) => s.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(t.state.scoreboard[0]?.score).toBe(3);
    expect(t.state.scoreboard[3]?.score).toBe(0);
  });

  it("starts the next round with a fresh prompt after the reveal timer", () => {
    const t = Table.started();
    playRound(t);
    t.tick(15_000);
    expect(t.phase).toBe("Writing");
    expect(t.state.roundNumber).toBe(2);
    expect(t.state.promptText).toBe("Which ocean is the largest on Earth?");
    expect(t.state.choices.length).toBe(0);
    expect(t.priv.usedPromptIds).toEqual(new Set(["p1", "p2"]));
  });

  it("wraps the prompt pool once every prompt was used", () => {
    const t = Table.started({ options: { rounds: 5 } });
    for (let round = 0; round < 4; ++round) {
      expect(t.phase).toBe("Writing");
      // Any distinct fakes and any legal vote do; only the prompt draw matters here.
      t.submitFake("p1", "fake one");
      t.submitFake("p2", "fake two");
      t.submitFake("p3", "fake three");
      t.submitFake("p4", "fake four");
      for (const voter of ["p1", "p2", "p3", "p4"]) {
        const index = t.state.choices.findIndex((o) => t.priv.optionAuthor.get(o.id) !== voter);
        t.act(voter, "CAST_VOTE", { optionId: t.state.choices[index]?.id ?? "" });
      }
      t.tick(15_000);
    }
    // Round 5: the pool of four wrapped around to the first prompt again.
    expect(t.state.roundNumber).toBe(5);
    expect(t.state.promptText).toBe("What is the capital of Australia?");
    expect(t.priv.usedPromptIds).toEqual(new Set(["p1"]));
  });

  it("shows an empty name for a player who never chose one", () => {
    const t = Table.started({ seats: [{}, {}, {}, { name: "" }] });
    t.submitFake("p1", "Sydney");
    t.submitFake("p2", "Perth");
    t.submitFake("p3", "Brisbane");
    t.submitFake("p4", "Adelaide");
    t.voteFor("p1", indexOf(t, "Canberra"));
    t.voteFor("p2", indexOf(t, "Adelaide"));
    t.voteFor("p3", indexOf(t, "Sydney"));
    t.voteFor("p4", indexOf(t, "Perth"));
    const p4 = t.state.results.find((r) => r.playerId === "p4");
    expect(p4?.name).toBe("");
    expect(p4?.roundPoints).toBe(1);
  });

  it("excludes a mid-game joiner from the scoreboard until activated", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playRound(t);
    t.joinLate("p5");
    t.tick(15_000);
    expect(t.phase).toBe("Results");
    expect(t.state.scoreboard.map((s) => s.playerId)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("ends on Results after the final round", () => {
    const t = Table.started({ options: { rounds: 1 } });
    playRound(t);
    t.tick(15_000);
    expect(t.phase).toBe("Results");
  });
});
