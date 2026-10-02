import { describe, expect, it } from "vitest";
import { parseBotsArgs, parsePlayArgs } from "../src/args.js";

const play = { maxBots: 7, usage: "Usage: play" };
const bots = { maxBots: 7, usage: "Usage: bots CODE" };

describe("parsePlayArgs", () => {
  it("defaults to three bots on the local server", () => {
    expect(parsePlayArgs([], play)).toEqual({
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
    const joined = parsePlayArgs(["--join=abcd"], play);
    expect(joined.ok && joined.value.join).toBe("ABCD");
    expect(joined.ok && joined.value.bots).toBe(0);
    const withBots = parsePlayArgs(["--join=ABCD", "--bots=2"], play);
    expect(withBots.ok && withBots.value.bots).toBe(2);
  });

  it("takes a name and a custom server, which turns the defaults off", () => {
    const parsed = parsePlayArgs(
      ["--name= Zed ", "--endpoint=ws://10.0.0.5:2567", "--api-port=4000"],
      play,
    );
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
    const portOnly = parsePlayArgs(["--api-port=4000"], play);
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
    ["--nope"],
    ["stray"],
  ])("rejects %s with the usage", (flag) => {
    expect(parsePlayArgs([flag], play)).toEqual({ ok: false, error: "Usage: play" });
  });

  it("limits bots to the game's maximum", () => {
    const parsed = parsePlayArgs(["--bots=4"], { maxBots: 3, usage: "u" });
    expect(parsed.ok).toBe(false);
  });
});

describe("parseBotsArgs", () => {
  it("reads the code and defaults the rest", () => {
    expect(parseBotsArgs(["abcd"], bots)).toEqual({
      ok: true,
      value: { code: "ABCD", count: 3, endpoint: "ws://localhost:2567", apiPort: 3001 },
    });
  });

  it("takes a count and a custom server", () => {
    expect(parseBotsArgs(["ABCD", "5", "--endpoint=ws://h:1", "--api-port=9"], bots)).toEqual({
      ok: true,
      value: { code: "ABCD", count: 5, endpoint: "ws://h:1", apiPort: 9 },
    });
  });

  it.each([
    [[]],
    [["abcd", "0"]],
    [["abcd", "8"]],
    [["abcd", "x"]],
    [["abcd", "1", "2"]],
    [["abcd", "--api-port=0"]],
    [["abcd", "--endpoint=nonsense"]],
    [["ab1"]],
    [["abcd", "--nope"]],
  ])("refuses %j with the usage", (argv) => {
    expect(parseBotsArgs(argv, bots)).toEqual({ ok: false, error: "Usage: bots CODE" });
  });
});
