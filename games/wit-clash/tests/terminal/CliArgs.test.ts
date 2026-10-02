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
    if (!parsed.ok) expect(parsed.error).toContain("cli:demo");
  });
});

describe("CliArgs.play", () => {
  it("defaults to three bots on the local server", () => {
    expect(args.play([])).toEqual({
      ok: true,
      value: {
        name: "You",
        bots: 3,
        join: undefined,
        endpoint: "ws://localhost:2567",
        apiPort: 3001,
        usesDefaults: true,
      },
    });
  });

  it("joins without bots unless they are asked for, and upper-cases the code", () => {
    const joined = args.play(["--join=abcd"]);
    expect(joined.ok && joined.value.join).toBe("ABCD");
    expect(joined.ok && joined.value.bots).toBe(0);
    const withBots = args.play(["--join=ABCD", "--bots=2"]);
    expect(withBots.ok && withBots.value.bots).toBe(2);
  });

  it("takes a name and a custom server, which turns the defaults off", () => {
    const parsed = args.play(["--name= Zed ", "--endpoint=ws://10.0.0.5:2567", "--api-port=4000"]);
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Zed",
        bots: 3,
        join: undefined,
        endpoint: "ws://10.0.0.5:2567",
        apiPort: 4000,
        usesDefaults: false,
      },
    });
    const portOnly = args.play(["--api-port=4000"]);
    expect(portOnly.ok && portOnly.value.usesDefaults).toBe(false);
  });

  it.each([
    ["--bots=8"],
    ["--bots=-1"],
    ["--name="],
    ["--name=123456789012345678901"],
    ["--join=AB"],
    ["--api-port=0"],
    ["--endpoint=nonsense"],
    ["--rounds=2"],
  ])("rejects %s with the usage", (flag) => {
    const parsed = args.play([flag]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("cli:play");
  });
});
