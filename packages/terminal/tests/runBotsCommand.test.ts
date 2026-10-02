import type { BotKit } from "@partygame/bots";
import { type NodeServerHandle, startNodeServer } from "@partygame/server/node";
import { waitFor } from "@partygame/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GameClient } from "../src/GameClient.js";
import { runBotsCommand } from "../src/runBotsCommand.js";
import { TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

const kit: BotKit<TapState> = {
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: { play: () => {} },
};

const USAGE = "Usage: bots CODE";

let handle: NodeServerHandle;
beforeAll(async () => {
  handle = await startNodeServer({
    games: [{ roomName: TAP_ROOM, definition: TapGame, stateClass: TapState }],
  });
});
afterAll(() => handle.stop());

const capture = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, push: (to: string[]) => (line: string) => void to.push(line) };
};

const serverArgs = (): string[] => [
  "--endpoint",
  handle.endpoint,
  "--api-port",
  String(handle.apiPort),
];

describe("runBotsCommand", () => {
  it("seats bots in a room, reports each and removes them on leave", async () => {
    const host = await new GameClient(handle.endpoint, handle.apiPort, kit).create(
      crypto.randomUUID(),
      "Ann",
    );
    const lines = capture();
    const running = await runBotsCommand({
      kit,
      maxBots: 5,
      argv: [host.state.roomCode.toLowerCase(), "2", ...serverArgs()],
      out: lines.push(lines.out),
      err: lines.push(lines.err),
      usage: USAGE,
      bot: { thinkMs: [0, 5], reactMs: [0, 5] },
    });
    const code = host.state.roomCode;
    expect(lines.out).toEqual([
      `Bot 1 joined ${code}`,
      `Bot 2 joined ${code}`,
      "Bots are playing. Ctrl+C removes them.",
    ]);
    expect(host.state.players.size).toBe(3);
    await running.leave();
    await waitFor(() => host.state.players.size === 1, "the bots to leave", 5000);
    await host.leave(true);
  });

  it("prints the usage and rejects on bad arguments", async () => {
    const lines = capture();
    await expect(
      runBotsCommand({
        kit,
        maxBots: 5,
        argv: ["abcd", "9"],
        out: lines.push(lines.out),
        err: lines.push(lines.err),
        usage: USAGE,
      }),
    ).rejects.toThrow(USAGE);
    expect(lines.out).toEqual([]);
    expect(lines.err).toEqual([USAGE]);
  });

  it("says why a room could not be joined and rejects", async () => {
    const lines = capture();
    await expect(
      runBotsCommand({
        kit,
        maxBots: 5,
        argv: ["QQQQ", ...serverArgs()],
        out: lines.push(lines.out),
        err: lines.push(lines.err),
        usage: USAGE,
      }),
    ).rejects.toThrow("Game code not found");
    expect(lines.err).toEqual(["Could not join QQQQ: Game code not found"]);
  });

  it("reports a failure that is not an Error by its text", async () => {
    const host = await new GameClient(handle.endpoint, handle.apiPort, kit).create(
      crypto.randomUUID(),
      "Ann",
    );
    class Exploding extends TapState {
      constructor() {
        super();
        throw "no seat for you";
      }
    }
    const lines = capture();
    await expect(
      runBotsCommand({
        kit: { ...kit, stateClass: Exploding },
        maxBots: 5,
        argv: [host.state.roomCode, ...serverArgs()],
        out: lines.push(lines.out),
        err: lines.push(lines.err),
        usage: USAGE,
      }),
    ).rejects.toBe("no seat for you");
    expect(lines.err).toEqual([`Could not join ${host.state.roomCode}: no seat for you`]);
    await host.leave(true);
  });

  it("hands over an interrupt handler before joining that removes the bots", async () => {
    const host = await new GameClient(handle.endpoint, handle.apiPort, kit).create(
      crypto.randomUUID(),
      "Ann",
    );
    const lines = capture();
    let stop: (() => Promise<void>) | undefined;
    let registeredBeforeJoin = false;
    const running = runBotsCommand({
      kit,
      maxBots: 5,
      argv: [host.state.roomCode, "1", ...serverArgs()],
      out: lines.push(lines.out),
      err: lines.push(lines.err),
      usage: USAGE,
      bot: { thinkMs: [0, 5], reactMs: [0, 5] },
      onInterrupt: (handler) => {
        stop = handler;
        registeredBeforeJoin = lines.out.length === 0;
      },
    });
    await running;
    expect(registeredBeforeJoin).toBe(true);
    await stop?.();
    await waitFor(() => host.state.players.size === 1, "the bots to leave", 5000);
    await host.leave(true);
  });

  it("an interrupt after a failed join only reports it", async () => {
    const lines = capture();
    let stop: (() => Promise<void>) | undefined;
    await expect(
      runBotsCommand({
        kit,
        maxBots: 5,
        argv: ["QQQQ", ...serverArgs()],
        out: lines.push(lines.out),
        err: lines.push(lines.err),
        usage: USAGE,
        onInterrupt: (handler) => {
          stop = handler;
        },
      }),
    ).rejects.toThrow();
    await stop?.();
    expect(lines.err).toEqual([
      "Could not join QQQQ: Game code not found",
      "Could not leave cleanly: Game code not found",
    ]);
  });
});
