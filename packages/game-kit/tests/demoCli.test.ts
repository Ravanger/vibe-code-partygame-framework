import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { demoCli } from "../src/index.js";
import { fakeIo } from "./fixtures/fakeIo.js";
import { TAP_PUBLIC_FIELDS, TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const roomLine = (players: number) =>
  new RegExp(`^Room [${ROOM_CODE_ALPHABET}]` + `{${ROOM_CODE_LENGTH}}: ${players} players$`);

const base = {
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  publicFields: TAP_PUBLIC_FIELDS,
  isFinished: (state: TapState): boolean => state.done,
};

describe("demoCli", () => {
  it("prints the usage and exits 2 on a bad --bots, a space-separated value or an unknown flag", async () => {
    for (const argv of [
      ["--bots=0"],
      ["--bots=9"],
      ["--bots=x"],
      ["--bots="],
      ["--bots", "4"],
      ["--foo"],
    ]) {
      const { io, err, exits } = fakeIo(argv);
      await demoCli({ ...base, botKit: tapKit() }, io);
      expect(err).toEqual(["Usage: bun run demo [--bots=1..5]"]);
      expect(exits).toEqual([2]);
    }
  });

  it("plays an all-bot game with the default bots and exits 0", async () => {
    const { io, log, exits } = fakeIo([]);
    await demoCli({ ...base, botKit: tapKit() }, io);
    expect(exits).toEqual([0]);
    expect(log.some((line) => roomLine(4).test(line))).toBe(true);
    expect(log.at(-1)).toBe("PASS: no action was rejected");
  }, 30_000);

  it("passes the demo extras to the run and exits 0", async () => {
    const names: string[] = [];
    const { io, log, exits } = fakeIo(["--bots=2"]);
    await demoCli(
      {
        ...base,
        botKit: tapKit(),
        demo: {
          roomOptions: {},
          hostName: "Hoster",
          bot: { thinkMs: [0, 20], reactMs: [0, 20] },
          narrate: (state) => (state.done ? ["done!"] : []),
          problems: (state) => {
            for (const player of state.players.values()) names.push(player.name);
            return [];
          },
          passMessage: "PASS: all tapped",
        },
      },
      io,
    );
    expect(exits).toEqual([0]);
    expect(log.some((line) => roomLine(3).test(line))).toBe(true);
    expect(log.some((line) => line === "done!")).toBe(true);
    expect(names).toContain("Hoster");
    expect(log.at(-1)).toBe("PASS: all tapped");
  }, 30_000);

  it("seats the full house at the upper bound and exits 0", async () => {
    const { io, log, exits } = fakeIo(["--bots=5"]);
    await demoCli(
      { ...base, botKit: tapKit(), demo: { bot: { thinkMs: [0, 20], reactMs: [0, 20] } } },
      io,
    );
    expect(exits).toEqual([0]);
    expect(log.some((line) => roomLine(6).test(line))).toBe(true);
    expect(log.at(-1)).toBe("PASS: no action was rejected");
  }, 30_000);

  it("refuses a bot count above the game's seats", async () => {
    const { io, err, exits } = fakeIo(["--bots=6"]);
    await demoCli({ ...base, botKit: tapKit() }, io);
    expect(err).toEqual(["Usage: bun run demo [--bots=1..5]"]);
    expect(exits).toEqual([2]);
  });

  it("fails with the problems the game reports and exits 1", async () => {
    const { io, log, exits } = fakeIo(["--bots=1"]);
    await demoCli(
      {
        ...base,
        botKit: tapKit(),
        demo: {
          bot: { thinkMs: [0, 20], reactMs: [0, 20] },
          problems: () => ["taps are off"],
        },
      },
      io,
    );
    expect(exits).toEqual([1]);
    expect(log.slice(-3)).toEqual(["", "  - taps are off", "FAIL"]);
  }, 30_000);

  it("prints one line and exits 1 when load rejects", async () => {
    const { io, err, exits } = fakeIo([]);
    await demoCli(
      {
        ...base,
        botKit: tapKit(),
        load: async () => {
          throw new Error("bad content");
        },
      },
      io,
    );
    expect(err).toEqual(["bad content"]);
    expect(exits).toEqual([1]);
  });
});
