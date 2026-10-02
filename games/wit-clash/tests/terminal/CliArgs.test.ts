import { describe, expect, it } from "vitest";
import { CliArgs } from "../../terminal/CliArgs.js";

const args = new CliArgs();

describe("CliArgs.demo", () => {
  it("defaults to four players and one round", () => {
    expect(args.demo([])).toEqual({ ok: true, value: { players: 4, rounds: 1 } });
  });

  it("reads --bots as the total player count and --rounds", () => {
    expect(args.demo(["--bots=6", "--rounds=2"])).toEqual({
      ok: true,
      value: { players: 6, rounds: 2 },
    });
  });

  it.each([
    ["--bots=2"],
    ["--bots=9"],
    ["--bots=x"],
    ["--rounds=0"],
    ["--rounds=11"],
    ["--name=Me"],
    ["--nope"],
    ["stray"],
  ])("rejects %s with the usage", (flag) => {
    const parsed = args.demo([flag]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("demo [--bots");
  });
});
