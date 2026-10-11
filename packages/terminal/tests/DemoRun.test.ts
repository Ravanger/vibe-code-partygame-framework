import type { BotOutcome, BotStrategy } from "@partygame/bots";
import { ServerProbe } from "@partygame/server/probe";
import { describe, expect, it } from "vitest";
import { DemoRun, type DemoRunOptions } from "../src/DemoRun.js";
import { TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

const tapStrategy: BotStrategy<TapState> = {
  play: (turn) => {
    if (turn.state.phase !== "Tap") return;
    turn.once("tap", () => turn.later("react", () => turn.act("TAP")));
  },
};

const bogusStrategy: BotStrategy<TapState> = {
  play: (turn) => {
    tapStrategy.play(turn);
    if (turn.state.phase !== "Tap") return;
    turn.once("bogus", () => turn.later("react", () => turn.act("BOGUS")));
  },
};

const setup = (over: Partial<DemoRunOptions<TapState>> = {}) => {
  const lines: string[] = [];
  const options: DemoRunOptions<TapState> = {
    games: [{ roomName: TAP_ROOM, definition: TapGame, stateClass: TapState }],
    kit: { roomName: TAP_ROOM, stateClass: TapState, strategy: tapStrategy },
    bots: 2,
    bot: { thinkMs: [0, 20], reactMs: [0, 20] },
    finished: (state) => state.done,
    out: (line) => lines.push(line),
    ...over,
  };
  return { lines, run: () => new DemoRun(options).run() };
};

describe("DemoRun", () => {
  it("plays one all-bot game, narrates it and passes", async () => {
    const taps: string[] = [];
    let last = 0;
    const { lines, run } = setup({
      narrate: (state) => {
        if (state.taps === last) return [];
        last = state.taps;
        taps.push(`taps=${state.taps}`);
        return [`taps=${state.taps}`];
      },
    });
    expect(await run()).toBe(true);
    expect(
      lines.some((line) =>
        /^Demo server on ws:\/\/127\.0\.0\.1:\d+, code API on port \d+$/.test(line),
      ),
    ).toBe(true);
    expect(lines.some((line) => /^Room [A-Z]{4}: 3 players$/.test(line))).toBe(true);
    expect(lines.filter((line) => line.startsWith("taps="))).toEqual(taps);
    expect(taps.length).toBeGreaterThan(0);
    expect(lines.at(-2)).toBe("");
    expect(lines.at(-1)).toBe("PASS: no action was rejected");
  }, 30_000);

  it("creates the room with the given options and host name", async () => {
    const names: string[] = [];
    const { run } = setup({
      roomOptions: {},
      hostName: "Hoster",
      problems: (state) => {
        for (const player of state.players.values()) names.push(player.name);
        return [];
      },
    });
    expect(await run()).toBe(true);
    expect(names).toContain("Hoster");
  }, 30_000);

  it("prints the given pass message", async () => {
    const { lines, run } = setup({ passMessage: "PASS: all tapped" });
    expect(await run()).toBe(true);
    expect(lines.at(-1)).toBe("PASS: all tapped");
  }, 30_000);

  it("fails on a refused action, naming it, and still reports every outcome to the caller", async () => {
    const outcomes: BotOutcome[] = [];
    const { lines, run } = setup({
      kit: { roomName: TAP_ROOM, stateClass: TapState, strategy: bogusStrategy },
      bot: { thinkMs: [0, 20], reactMs: [0, 20], onOutcome: (outcome) => outcomes.push(outcome) },
    });
    expect(await run()).toBe(false);
    expect(lines.some((line) => /^ {2}- Bot 1 was refused on BOGUS:/.test(line))).toBe(true);
    expect(lines.at(-1)).toBe("FAIL");
    expect(outcomes.some((outcome) => outcome.type === "TAP" && outcome.ok)).toBe(true);
    expect(outcomes.some((outcome) => outcome.type === "BOGUS" && !outcome.ok)).toBe(true);
  }, 30_000);

  it("fails with the problems the game reports", async () => {
    const { lines, run } = setup({ problems: () => ["taps are off"] });
    expect(await run()).toBe(false);
    expect(lines.slice(-3)).toEqual(["", "  - taps are off", "FAIL"]);
  }, 30_000);

  it("fails when the game does not finish in time", async () => {
    const { lines, run } = setup({ timeoutMs: 50, bot: { reactMs: [5000, 6000] } });
    expect(await run()).toBe(false);
    expect(lines.at(-1)).toBe("FAIL: Timed out waiting for the end of the game");
  }, 30_000);

  it("fails and stops the server when the room cannot be created", async () => {
    const { lines, run } = setup({ games: [] });
    expect(await run()).toBe(false);
    expect(lines.at(-1)).toMatch(/^FAIL: /);
    const port = Number(/ws:\/\/127\.0\.0\.1:(\d+)/.exec(lines[0] ?? "")?.[1]);
    expect(await new ServerProbe().canConnect(port, "127.0.0.1")).toBe(false);
  }, 30_000);

  it("fails with the text of a failure that is not an Error", async () => {
    const { lines, run } = setup({
      narrate: () => {
        throw "boom";
      },
    });
    expect(await run()).toBe(false);
    expect(lines.at(-1)).toBe("FAIL: boom");
  }, 30_000);
});
