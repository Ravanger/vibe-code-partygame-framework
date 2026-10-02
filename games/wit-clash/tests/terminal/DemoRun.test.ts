import { describe, expect, it } from "vitest";
import { WitClashState } from "../../src/state.js";
import { type DemoOptions, DemoRun } from "../../terminal/DemoRun.js";
import { makeCategories } from "../game/support.js";
import { row } from "./support.js";

const run = (over: Partial<DemoOptions> = {}) => {
  const lines: string[] = [];
  const demo = new DemoRun({
    players: 3,
    rounds: 1,
    categories: makeCategories(4, 8, 2),
    out: (line) => lines.push(line),
    answerDelayMs: [0, 30],
    voteDelayMs: [0, 30],
    revealSeconds: 1,
    ...over,
  });
  return { demo, lines };
};

describe("DemoRun", () => {
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
    const { demo, lines } = run({ timeoutMs: 50, answerDelayMs: [5000, 6000] });
    expect(await demo.run()).toBe(false);
    expect(lines.at(-1)).toMatch(/^FAIL: Timed out waiting for the final results/);
  }, 30_000);

  it("fails with the message of any error that is not an Error", async () => {
    const { demo, lines } = run({ players: 3 });
    Object.defineProperty(demo, "play", {
      value: () => Promise.reject("boom"),
    });
    expect(await demo.run()).toBe(false);
    expect(lines.at(-1)).toBe("FAIL: boom");
  });

  it("lists score mismatches and refused actions as problems", () => {
    const { demo } = run();
    const state = new WitClashState();
    state.scoreboard.push(row("p1", "Ann", 7));
    demo.record({ bot: "Bot 1", type: "CAST_VOTE", ok: false, detail: '{"ok":false}' });
    demo.record({ bot: "Bot 2", type: "CAST_VOTE", ok: true, detail: '{"ok":true}' });
    const problems = demo.problems(state);
    expect(problems).toEqual([
      "Ann: scoreboard says 7, the reveals add up to 0",
      'Bot 1 was refused on CAST_VOTE: {"ok":false}',
    ]);
    expect(demo.verdict(problems)).toEqual([
      "",
      `  - ${problems[0]}`,
      `  - ${problems[1]}`,
      "FAIL",
    ]);
    expect(demo.verdict([])[1]).toMatch(/^PASS/);
  });
});
