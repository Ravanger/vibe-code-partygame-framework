import { startNodeServer } from "@partygame/server/node";
import type { TerminalStrategy } from "@partygame/terminal";
import { ScriptedIo } from "@partygame/terminal/testing";
import { describe, expect, it, vi } from "vitest";
import { defineGamePackage, type GameKitIo, hostedGame, play } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const tapTerminal = (): TerminalStrategy<TapState> => ({
  play: async (turn) => {
    if (turn.state.phase !== "Tap") return;
    await turn.ask("Tap?");
    await turn.send("TAP", {}, "tapped");
  },
});

const pkg = defineGamePackage({
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  isFinished: (state) => state.done,
  botKit: tapKit(),
  terminal: tapTerminal,
});

const bare = defineGamePackage({
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  isFinished: (state) => state.done,
  botKit: tapKit(),
});

const fakeIo = (argv: string[], over: Partial<GameKitIo> = {}) => {
  const log: string[] = [];
  const err: string[] = [];
  const exits: number[] = [];
  const io: GameKitIo = {
    env: {},
    argv,
    exit: (code) => void exits.push(code),
    log: (line) => void log.push(line),
    error: (line) => void err.push(line),
    ...over,
  };
  return { io, log, err, exits };
};

describe("play", () => {
  it("prints the usage and exits 2 on bad arguments", async () => {
    const { io, err, exits } = fakeIo(["--bots=9"], { prompter: new ScriptedIo() });
    await play(pkg, io);
    expect(err).toEqual([
      "Usage: bun run play [--bots=0..5] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]",
    ]);
    expect(exits).toEqual([2]);
  });

  it("reports a game without a terminal strategy and exits 1", async () => {
    const { io, err, exits } = fakeIo(["--name=Ann"], { prompter: new ScriptedIo() });
    await play(bare, io);
    expect(err).toEqual(["This game has no terminal strategy."]);
    expect(exits).toEqual([1]);
  });

  it("refuses a bot count above the game's seats", async () => {
    const { io, err, exits } = fakeIo(["--bots=6"], { prompter: new ScriptedIo() });
    await play(bare, io);
    expect(err).toEqual([
      "Usage: bun run play [--bots=0..5] [--name=You] [--join=ABCD] [--endpoint=ws://host:2567 --api-port=3001]",
    ]);
    expect(exits).toEqual([2]);
  });

  it("plays a session against a started server and exits 0", async () => {
    const handle = await startNodeServer({ games: [hostedGame(pkg, undefined)] });
    try {
      const prompter = new ScriptedIo();
      let signal: (() => void) | undefined;
      let signalName: string | undefined;
      const { io, exits } = fakeIo(
        ["--name=Ann", "--bots=1", "--endpoint", handle.endpoint, `--api-port=${handle.apiPort}`],
        {
          onSignal: (name, handler) => {
            signalName = name;
            signal = handler;
          },
          prompter,
        },
      );
      const playing = play(pkg, io);
      await vi.waitFor(() => expect(prompter.printed).toContain("Bot 1 joined."), {
        timeout: 15_000,
      });
      await prompter.type("");
      await vi.waitFor(
        () => expect(prompter.asked.some((question) => question.includes("Tap?"))).toBe(true),
        { timeout: 15_000 },
      );
      await prompter.type("x");
      await vi.waitFor(() => expect(prompter.printed).toContain("tapped"), { timeout: 15_000 });
      signal?.();
      await playing;
      expect(signalName).toBe("SIGINT");
      expect(exits).toEqual([0]);
      expect(prompter.printed.some((line) => line.startsWith("Room "))).toBe(true);
    } finally {
      await handle.stop();
    }
  }, 30_000);
});
