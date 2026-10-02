import { describe, expect, it } from "vitest";
import { witClashDemo } from "../../terminal/witClashDemo.js";
import { makeCategories } from "../game/support.js";

const run = (over: { rounds?: number; timeoutMs?: number; slow?: boolean } = {}) => {
  const lines: string[] = [];
  const demo = witClashDemo({
    players: 3,
    rounds: over.rounds ?? 1,
    categories: makeCategories(4, 8, 2),
    out: (line) => lines.push(line),
    bot: over.slow
      ? { thinkMs: [5000, 6000], reactMs: [5000, 6000] }
      : { thinkMs: [0, 30], reactMs: [0, 30] },
    ...(over.timeoutMs === undefined ? {} : { timeoutMs: over.timeoutMs }),
  });
  return { demo, lines };
};

describe("witClashDemo", () => {
  it("plays a whole all-bot game, narrates it and passes", async () => {
    const { demo, lines } = run({ rounds: 2 });
    expect(await demo.run()).toBe(true);
    const said = lines.join("\n");
    expect(said).toMatch(/Demo server on ws:\/\/127\.0\.0\.1:\d+/);
    expect(said).toContain("Lobby, 3 players: Host Bot, Bot 1, Bot 2");
    expect(said).toContain("=== Round 2 of 2 ===");
    expect(said).toContain("Scores after round 1");
    expect(said).toContain("=== Final scores ===");
    expect(lines.at(-1)).toBe("PASS: scores match the reveals, no action was rejected");
  }, 90_000);

  it("fails when the game does not finish in time", async () => {
    const { demo, lines } = run({ timeoutMs: 50, slow: true });
    expect(await demo.run()).toBe(false);
    expect(lines.at(-1)).toMatch(/^FAIL: Timed out waiting for the end of the game/);
  }, 30_000);

  it("paces the bots by default", async () => {
    const lines: string[] = [];
    const demo = witClashDemo({
      players: 3,
      rounds: 1,
      categories: makeCategories(4, 8, 2),
      out: (line) => lines.push(line),
      timeoutMs: 50,
    });
    expect(await demo.run()).toBe(false);
    expect(lines.at(-1)).toMatch(/^FAIL: Timed out/);
  }, 30_000);
});
