import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { GameClient } from "@partygame/terminal";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { botsCli, defineGamePackage, hostedGame } from "../src/index.js";
import { fakeIo } from "./fixtures/fakeIo.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const pkg = defineGamePackage({
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  isFinished: (state) => state.done,
  botKit: tapKit(),
});

let handle: NodeServerHandle;
beforeAll(async () => {
  handle = await startNodeServer({ games: [hostedGame(pkg, undefined)] });
});
afterAll(() => handle.stop());

describe("botsCli", () => {
  it("seats the bots for a valid code and leaves them on SIGINT with exit 0", async () => {
    const host = await new GameClient(handle.endpoint, handle.apiPort, tapKit()).create(
      crypto.randomUUID(),
      "Ann",
    );
    let signal: (() => void) | undefined;
    let signalName: string | undefined;
    const { io, log, exits } = fakeIo(
      [
        host.state.roomCode.toLowerCase(),
        "2",
        "--endpoint",
        handle.endpoint,
        "--api-port",
        String(handle.apiPort),
      ],
      {
        onSignal: (name, handler) => {
          signalName = name;
          signal = handler;
        },
      },
    );
    await botsCli(pkg, io);
    expect(log).toEqual([
      `Bot 1 joined ${host.state.roomCode}`,
      `Bot 2 joined ${host.state.roomCode}`,
      "Bots are playing. Ctrl+C removes them.",
    ]);
    expect(exits).toEqual([]);
    expect(signalName).toBe("SIGINT");
    expect(host.state.players.size).toBe(3);
    signal?.();
    await vi.waitFor(() => expect(exits).toEqual([0]), { timeout: 5000 });
    await host.leave(true);
  }, 30_000);

  it("prints the usage and exits 2 on bad arguments", async () => {
    const { io, log, err, exits } = fakeIo([]);
    await botsCli(pkg, io);
    expect(log).toEqual([]);
    expect(err).toEqual([
      "Usage: bun run bots <CODE> [count=3] [--endpoint ws://localhost:2567] [--api-port 3001]\n" +
        "CODE is 4 letters; count is 1 to 5.",
    ]);
    expect(exits).toEqual([2]);
  });

  it("reports a missing room and exits 1", async () => {
    const { io, err, exits } = fakeIo([
      "QQQQ",
      "--endpoint",
      handle.endpoint,
      "--api-port",
      String(handle.apiPort),
    ]);
    await botsCli(pkg, io);
    expect(err).toEqual(["Could not join QQQQ: Game code not found"]);
    expect(exits).toEqual([1]);
  });

  it("refuses a count above the game's seats", async () => {
    const { io, err, exits } = fakeIo([
      "QQQQ",
      "6",
      "--endpoint",
      handle.endpoint,
      "--api-port",
      String(handle.apiPort),
    ]);
    await botsCli(pkg, io);
    expect(err).toEqual([
      "Usage: bun run bots <CODE> [count=3] [--endpoint ws://localhost:2567] [--api-port 3001]\n" +
        "CODE is 4 letters; count is 1 to 5.",
    ]);
    expect(exits).toEqual([2]);
  });
});
