import { describe, expect, it } from "vitest";
import { makeCategories, Table, type TableConfig } from "./support.js";

const inPrompting = (config: TableConfig = {}) => {
  const t = new Table(config);
  t.toPrompting();
  return t;
};

const firstPrompt = (t: Table, id: string) => t.mine(id).prompts[0]?.matchupId as string;

const answerAll = (t: Table, ids: string[], answer = "a") => {
  for (const id of ids) {
    for (const p of t.mine(id).prompts)
      t.act(id, "SUBMIT_ANSWER", { matchupId: p.matchupId, answer });
  }
};

describe("entering Prompting", () => {
  it("builds one matchup per player from the winning category", () => {
    const t = inPrompting();
    const category = t.priv.categoryId.slice(4);
    expect(t.phase).toBe("Prompting");
    expect(t.state.matchups).toHaveLength(4);
    for (const m of t.state.matchups)
      expect(m.promptText.startsWith(`Prompt ${category}.`)).toBe(true);
    expect([...t.state.matchups].every((m) => m.answers.length === 0)).toBe(true);
  });

  it("deals every player exactly two prompts, privately, none submitted", () => {
    const t = inPrompting();
    for (const id of t.ids()) {
      expect(t.mine(id).prompts).toHaveLength(2);
      expect([...t.mine(id).prompts].every((p) => !p.submitted && p.promptText !== "")).toBe(true);
    }
    expect(t.state.answersPerPlayer).toBe(2);
  });

  it("starts every player's public progress at zero", () => {
    const t = inPrompting();
    expect([...t.state.progress.entries()].sort()).toEqual([
      ["p1", 0],
      ["p2", 0],
      ["p3", 0],
      ["p4", 0],
    ]);
  });

  it("sets the deadline from the prompt option", () => {
    const t = inPrompting({ options: { promptSeconds: 45 } });
    expect(t.state.phaseEndsAt - t.host.time).toBe(45_000);
  });

  it("gives two remaining players one shared matchup and one prompt each", () => {
    const t = new Table({ players: 3 });
    t.start();
    t.drop("p3");
    t.voteFirstCategory();
    expect(t.phase).toBe("Prompting");
    expect(t.state.matchups).toHaveLength(1);
    expect(t.state.answersPerPlayer).toBe(1);
    expect(t.mine("p1").prompts).toHaveLength(1);
    expect(t.mine("p2").prompts).toHaveLength(1);
  });
});

describe("entering Prompting with nobody left", () => {
  it("skips straight to Results", () => {
    const t = new Table({ players: 3 });
    t.start();
    for (const id of ["p1", "p2", "p3"]) t.drop(id);
    t.tick(60_000);
    expect(t.phase).toBe("Results");
    expect(t.state.matchups).toHaveLength(0);
  });
});

describe("START_GAME", () => {
  it("is refused below minPlayers", () => {
    const t = new Table({ players: 2 });
    t.act("p1", "START_GAME");
    expect(t.phase).toBe("Lobby");
    expect(t.errors("p1")).toMatchObject([{ code: "NOT_ENOUGH_PLAYERS" }]);
  });
});

describe("SUBMIT_ANSWER", () => {
  it("accepts an answer for an assigned prompt and counts it publicly", () => {
    const t = inPrompting();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: firstPrompt(t, "p1"), answer: "  hi  " });
    expect(t.mine("p1").prompts[0]?.submitted).toBe(true);
    expect(t.state.progress.get("p1")).toBe(1);
    expect(t.priv.drafts.get("p1")?.get(firstPrompt(t, "p1"))).toBe("hi");
  });

  it("lets a player edit an answer without double counting", () => {
    const t = inPrompting();
    const matchupId = firstPrompt(t, "p1");
    t.act("p1", "SUBMIT_ANSWER", { matchupId, answer: "first" });
    t.act("p1", "SUBMIT_ANSWER", { matchupId, answer: "second" });
    expect(t.state.progress.get("p1")).toBe(1);
    expect(t.priv.drafts.get("p1")?.get(matchupId)).toBe("second");
  });

  it("rejects a prompt that was not assigned to the player", () => {
    const t = inPrompting();
    const foreign = [...t.state.matchups].find(
      (m) => !t.priv.assignments.get("p1")?.includes(m.id),
    );
    t.act("p1", "SUBMIT_ANSWER", { matchupId: foreign?.id, answer: "x" });
    t.act("p1", "SUBMIT_ANSWER", { matchupId: "unknown", answer: "x" });
    expect(t.errors("p1")).toMatchObject([{ code: "NOT_ALLOWED" }, { code: "NOT_ALLOWED" }]);
    expect(t.state.progress.get("p1")).toBe(0);
  });

  it("rejects blank and over-long answers", () => {
    const t = inPrompting();
    const matchupId = firstPrompt(t, "p1");
    t.act("p1", "SUBMIT_ANSWER", { matchupId, answer: "   " });
    t.act("p1", "SUBMIT_ANSWER", { matchupId, answer: "x".repeat(201) });
    expect(t.errors("p1")).toMatchObject([{ code: "INVALID_ACTION" }, { code: "INVALID_ACTION" }]);
  });

  it("keeps answers out of the synced state", () => {
    const t = inPrompting();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: firstPrompt(t, "p1"), answer: "SECRET-TEXT" });
    expect(JSON.stringify(t.state.matchups.toJSON())).not.toContain("SECRET-TEXT");
    expect(JSON.stringify(t.state.progress.toJSON())).not.toContain("SECRET-TEXT");
  });

  it("is rejected outside Prompting", () => {
    const t = new Table();
    t.start();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: "m", answer: "x" });
    expect(t.errors("p1")).toMatchObject([{ code: "WRONG_PHASE" }]);
  });

  it("does not advance while a player has answered only one prompt", () => {
    const t = inPrompting();
    answerAll(t, ["p1", "p2", "p3"]);
    t.act("p4", "SUBMIT_ANSWER", { matchupId: firstPrompt(t, "p4"), answer: "a" });
    expect(t.phase).toBe("Prompting");
  });

  it("advances once every player has submitted every answer", () => {
    const t = inPrompting();
    t.answerEverything();
    expect(t.phase).toBe("MatchupVoting");
    for (const m of t.state.matchups) expect(m.answers).toHaveLength(2);
  });
});

describe("finishing Prompting", () => {
  it("fills a placeholder for each missing answer at the deadline, and hides authors", () => {
    const t = inPrompting();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: firstPrompt(t, "p1"), answer: "mine" });
    t.tick(90_000);
    expect(t.state.activeMatchupIndex).toBe(0);
    const texts = [...t.state.matchups].flatMap((m) => [...m.answers].map((a) => a.text));
    expect(texts).toContain("mine");
    expect(t.priv.placeholders.size).toBe(7);
    for (const m of [...t.state.matchups].filter((x) => !x.isRevealed)) {
      for (const a of m.answers) expect(a.authorId).toBe("");
    }
  });

  it("skips matchups nobody answered and renumbers the rest", () => {
    const t = inPrompting();
    answerAll(t, ["p1"]);
    const answered = new Set(["p1"].flatMap((id) => t.priv.assignments.get(id) ?? []));
    t.tick(90_000);
    const shown = [...t.state.matchups];
    expect(shown).toHaveLength(2);
    expect(shown.every((m) => answered.has(m.id))).toBe(true);
    expect(shown.map((m) => m.index)).toEqual(shown.map((_, i) => i));
  });

  it("goes straight to Results when nothing was answered at all", () => {
    const t = inPrompting();
    t.tick(90_000);
    expect(t.phase).toBe("Results");
    expect(t.state.matchups).toHaveLength(0);
  });

  it("marks a matchup with exactly one real answer as a forfeit", () => {
    const t = inPrompting();
    t.act("p1", "SUBMIT_ANSWER", { matchupId: firstPrompt(t, "p1"), answer: "alone" });
    t.tick(90_000);
    const forfeits = [...t.state.matchups].filter((m) => m.isForfeit);
    expect(forfeits).toHaveLength(1);
    expect([...(forfeits[0]?.answers ?? [])].map((a) => a.text).sort()).toEqual([
      "(no answer)",
      "alone",
    ]);
  });
});

describe("a player leaving during Prompting", () => {
  it("completes the phase when they were the only holdout; their matchups become forfeits", () => {
    const t = inPrompting();
    answerAll(t, ["p1", "p2", "p3"]);
    expect(t.phase).toBe("Prompting");
    t.leave("p4");
    expect(t.state.activeMatchupIndex).toBe(0);
    expect(t.state.progress.has("p4")).toBe(false);
    expect(t.state.mine.has("p4")).toBe(false);
    expect([...t.state.matchups].filter((m) => m.isForfeit)).toHaveLength(2);
  });

  it("moves on at once when everyone still connected has answered, forfeiting the absent author", () => {
    const t = inPrompting();
    t.drop("p4");
    answerAll(t, ["p1", "p2", "p3"]);
    expect(t.phase).not.toBe("Prompting");
    expect([...t.state.matchups].filter((m) => m.isForfeit)).toHaveLength(2);
    expect(t.mine("p4").prompts).toHaveLength(2);
  });

  it("finishes the moment the last connected holdout drops", () => {
    const t = inPrompting();
    answerAll(t, ["p1", "p2", "p3"]);
    t.drop("p4");
    expect(t.phase).not.toBe("Prompting");
  });

  it("lets a dropped author come back and answer while others are still writing", () => {
    const t = inPrompting();
    t.drop("p4");
    answerAll(t, ["p1", "p2"]);
    t.rejoin("p4");
    expect(t.phase).toBe("Prompting");
    answerAll(t, ["p3", "p4"]);
    expect(t.phase).toBe("MatchupVoting");
    expect([...t.state.matchups].filter((m) => m.isForfeit)).toHaveLength(0);
  });

  it("keeps a reconnecting player's prompts, drafts and progress", () => {
    const t = inPrompting();
    const first = firstPrompt(t, "p2");
    t.act("p2", "SUBMIT_ANSWER", { matchupId: first, answer: "kept" });
    t.drop("p2");
    t.rejoin("p2");
    expect(t.mine("p2").prompts).toHaveLength(2);
    expect(t.mine("p2").prompts[0]?.submitted).toBe(true);
    expect(t.state.progress.get("p2")).toBe(1);
    expect(t.priv.drafts.get("p2")?.get(first)).toBe("kept");
  });

  it("keeps waiting when everyone who held an assignment has gone", () => {
    const t = inPrompting();
    for (const id of t.ids()) t.drop(id);
    expect(t.phase).toBe("Prompting");
    t.tick(90_000);
    expect(t.phase).toBe("Results");
  });
});

describe("no repeat prompts", () => {
  it("never reuses a prompt across the rounds of a game", () => {
    const t = new Table({ options: { totalRounds: 2 }, categories: makeCategories(1, 8) });
    t.toResults();
    const firstRound = new Set(t.priv.usedPromptIds);
    expect(firstRound.size).toBe(4);
    t.act("p1", "NEXT_ROUND");
    t.voteFirstCategory();
    expect(t.phase).toBe("Prompting");
    expect(t.priv.usedPromptIds.size).toBe(8);
    const secondRound = new Set([...t.state.matchups].map((m) => m.promptText));
    expect(secondRound.size).toBe(4);
    for (const id of firstRound) expect(secondRound.has(`Prompt 0.${id.slice(-1)}`)).toBe(false);
  });

  it("resets the category's used set when it cannot supply enough fresh prompts", () => {
    const t = new Table({ options: { totalRounds: 3 }, categories: makeCategories(1, 6) });
    t.toResults();
    expect(t.priv.usedPromptIds.size).toBe(4);
    t.act("p1", "NEXT_ROUND");
    t.voteFirstCategory();
    expect(t.state.matchups).toHaveLength(4);
    expect(t.priv.usedPromptIds.size).toBe(4);
  });

  it("forgets used prompts on PLAY_AGAIN", () => {
    const t = new Table({ options: { totalRounds: 1 } });
    t.toResults();
    expect(t.priv.usedPromptIds.size).toBeGreaterThan(0);
    t.act("p1", "PLAY_AGAIN");
    expect(t.priv.usedPromptIds.size).toBe(0);
  });
});
