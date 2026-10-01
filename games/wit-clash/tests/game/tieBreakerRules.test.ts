import { describe, expect, it } from "vitest";
import {
  pickTieBreakerPrompt,
  resolveTieBreaker,
  tieBreakerVoterIds,
  topScorers,
} from "../../src/tieBreaker.js";
import { makeCategories } from "./support.js";

describe("topScorers", () => {
  it("returns everyone on the highest score, counting missing scores as zero", () => {
    expect(topScorers({ a: 3, b: 3, c: 1 }, ["a", "b", "c", "d"])).toEqual(["a", "b"]);
    expect(topScorers({}, ["a", "b"])).toEqual(["a", "b"]);
    expect(topScorers({ a: 1 }, [])).toEqual([]);
  });
});

describe("tieBreakerVoterIds", () => {
  it("is everyone outside the tie", () => {
    expect(tieBreakerVoterIds(["a", "b", "c"], ["a"])).toEqual(["b", "c"]);
  });

  it("is nobody when the whole room is in the tie", () => {
    expect(tieBreakerVoterIds(["a", "b"], ["a", "b"])).toEqual([]);
  });
});

describe("resolveTieBreaker", () => {
  it("picks a single top vote-getter", () => {
    expect(
      resolveTieBreaker([
        { authorId: "a", votes: 1 },
        { authorId: "b", votes: 3 },
      ]),
    ).toEqual({ winnerId: "b", leaderIds: ["b"] });
  });

  it("gives a lone answer the win", () => {
    expect(resolveTieBreaker([{ authorId: "a", votes: 0 }]).winnerId).toBe("a");
  });

  it("reports the authors still level", () => {
    expect(
      resolveTieBreaker([
        { authorId: "a", votes: 2 },
        { authorId: "b", votes: 2 },
        { authorId: "c", votes: 0 },
      ]),
    ).toEqual({ winnerId: undefined, leaderIds: ["a", "b"] });
  });

  it("has no winner and no leaders without answers", () => {
    expect(resolveTieBreaker([])).toEqual({ winnerId: undefined, leaderIds: [] });
  });
});

describe("pickTieBreakerPrompt", () => {
  const categories = makeCategories(3, 2, 2).all();

  it("prefers the given category", () => {
    const prompt = pickTieBreakerPrompt(categories, "cat-1", new Set(), () => 0);
    expect(prompt?.id).toBe("cat-1-tb0");
  });

  it("skips used prompts, then moves on to the other categories", () => {
    expect(pickTieBreakerPrompt(categories, "cat-1", new Set(["cat-1-tb0"]), () => 0)?.id).toBe(
      "cat-1-tb1",
    );
    const used = new Set(["cat-1-tb0", "cat-1-tb1"]);
    expect(pickTieBreakerPrompt(categories, "cat-1", used, () => 0.99)?.id).toBe("cat-2-tb1");
  });

  it("is undefined when everything is used", () => {
    const used = new Set(categories.flatMap((c) => c.tieBreakers.map((p) => p.id)));
    expect(pickTieBreakerPrompt(categories, "cat-1", used, () => 0)).toBeUndefined();
  });
});
