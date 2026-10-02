import type { Room } from "@colyseus/sdk";
import type { BotKit } from "@partygame/bots";
import { freePort, ServerProbe, startNodeServer } from "@partygame/server/node";
import { waitFor } from "@partygame/shared";
import { afterEach, describe, expect, it } from "vitest";
import { GameClient } from "../src/GameClient.js";
import { PlaySession, type PlaySessionOptions, type SessionPlayer } from "../src/PlaySession.js";
import { ScriptedIo } from "../src/testing.js";
import { TAP_ROOM, TapGame, TapState } from "./fixtures/tapGame.js";

const game = { roomName: TAP_ROOM, definition: TapGame, stateClass: TapState };
const kit: BotKit<TapState> = {
  roomName: TAP_ROOM,
  stateClass: TapState,
  strategy: { play: () => {} },
};

class ViteUp extends ServerProbe {
  override async answers(): Promise<boolean> {
    return true;
  }
}

class StubPlayer implements SessionPlayer {
  stopped = false;
  private finish: () => void = () => {};
  private readonly done = new Promise<void>((resolve) => {
    this.finish = resolve;
  });

  constructor(readonly room: Room<TapState>) {}

  run(): Promise<void> {
    return this.done;
  }

  stop(): void {
    this.stopped = true;
    this.finish();
  }
}

let players: StubPlayer[] = [];
const options = async (
  over: Partial<PlaySessionOptions<TapState>> = {},
): Promise<PlaySessionOptions<TapState>> => ({
  name: "Ann",
  bots: 0,
  join: undefined,
  endpoint: `ws://localhost:${await freePort()}`,
  apiPort: await freePort(),
  startServer: true,
  clientUrl: "http://localhost:5173",
  kit,
  games: [game],
  player: (room) => {
    const player = new StubPlayer(room);
    players.push(player);
    return player;
  },
  bot: { thinkMs: [0, 5], reactMs: [0, 5] },
  ...over,
});

const sessions: Array<PlaySession<TapState>> = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
  players = [];
});

describe("PlaySession", () => {
  it("starts a server, hosts a room, seats bots, prints the links and cleans up", async () => {
    const io = new ScriptedIo();
    const session = new PlaySession(await options({ bots: 2 }), io, new ViteUp());
    sessions.push(session);
    const running = session.run();
    await waitFor(() => io.printed.includes("Bot 2 joined."), "the bots", 5000);
    const room = players[0]?.room;
    expect(room?.state.players.size).toBe(3);
    session.stop();
    await running;

    const said = io.printed.join("\n");
    expect(said).toMatch(/Started a game server on ports \d+ and \d+/);
    expect(said).toMatch(/Room [A-Z]{4} \(you are the host\)/);
    expect(said).toMatch(/Browser players can join at http:\/\/localhost:5173\/\?code=[A-Z]{4}/);
    expect(said).toMatch(/TV view: http:\/\/localhost:5173\/\?tv=[A-Z]{4}/);
    expect(said).toContain("Bot 1 joined.");
  });

  it("seats bots with the strategy's default pacing when no bot options are given", async () => {
    const io = new ScriptedIo();
    const { bot: _bot, ...rest } = await options({ bots: 1 });
    const session = new PlaySession(rest, io, new ViteUp());
    sessions.push(session);
    const running = session.run();
    await waitFor(() => io.printed.includes("Bot 1 joined."), "the bot", 5000);
    session.stop();
    await running;
  });

  it("removes seated bots when the player fails", async () => {
    const handle = await startNodeServer({ games: [game] });
    try {
      const host = await new GameClient(handle.endpoint, handle.apiPort, kit).create(
        crypto.randomUUID(),
        "Host",
      );
      const io = new ScriptedIo();
      const session = new PlaySession(
        await options({
          bots: 1,
          join: host.state.roomCode,
          endpoint: handle.endpoint,
          apiPort: handle.apiPort,
          startServer: false,
          player: () => ({
            run: async () => {
              await waitFor(() => io.printed.includes("Bot 1 joined."), "the bot", 5000);
              expect(host.state.players.size).toBe(3);
              throw new Error("player crashed");
            },
            stop: () => {},
          }),
        }),
        io,
      );
      await expect(session.run()).rejects.toThrow("player crashed");
      await waitFor(() => host.state.players.size === 1, "the bot to leave", 5000);
      await host.leave(true);
    } finally {
      await handle.stop();
    }
  });

  it("fails and still leaves the room when the bots cannot be seated", async () => {
    const io = new ScriptedIo();
    const over = { run: () => Promise.resolve(), stop: () => {} };
    const session = new PlaySession(
      await options({ bots: 6, player: () => over }),
      io,
      new ViteUp(),
    );
    await expect(session.run()).rejects.toThrow();
  });

  it("raises no unhandled rejection when the bots fail while the player is still playing", async () => {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      const slow = {
        run: () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        stop: () => {},
      };
      const session = new PlaySession(
        await options({ bots: 6, player: () => slow }),
        new ScriptedIo(),
        new ViteUp(),
      );
      await expect(session.run()).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  it("hands the room options to a room it creates", async () => {
    const session = new PlaySession(
      await options({ roomOptions: { seats: ["a-0000001"] } }),
      new ScriptedIo(),
      new ViteUp(),
    );
    await expect(session.run()).rejects.toThrow("watch-only");
  });

  it("prints no links when the client is not running", async () => {
    const io = new ScriptedIo();
    const session = new PlaySession(
      await options(),
      io,
      new (class extends ServerProbe {
        override async answers(): Promise<boolean> {
          return false;
        }
      })(),
    );
    const running = session.run();
    await waitFor(() => players.length === 1, "the player", 5000);
    session.stop();
    await running;
    expect(io.printed.some((line) => line.startsWith("Browser players"))).toBe(false);
  });

  it("joins a room on a running server as a plain player and can quit", async () => {
    const handle = await startNodeServer({ games: [game] });
    try {
      const host = await new GameClient(handle.endpoint, handle.apiPort, kit).create(
        crypto.randomUUID(),
        "Host",
      );
      const io = new ScriptedIo();
      const session = new PlaySession(
        await options({
          join: host.state.roomCode,
          endpoint: handle.endpoint,
          apiPort: handle.apiPort,
          startServer: false,
        }),
        io,
      );
      const running = session.run();
      await waitFor(() => players.length === 1, "the player", 5000);
      expect(io.printed).toContain(`Joined room ${host.state.roomCode}`);
      expect(io.printed.some((line) => line.startsWith("Browser players"))).toBe(false);
      expect(io.printed.some((line) => line.startsWith("Using the game server"))).toBe(true);
      session.stop();
      await running;
      await host.leave(true);
    } finally {
      await handle.stop();
    }
  });

  it("stops the player when asked before it is up", async () => {
    const session = new PlaySession(await options(), new ScriptedIo(), new ViteUp());
    session.stop();
    await session.run();
    expect(players[0]?.stopped).toBe(true);
  });

  it("reports a missing server instead of starting one when told not to", async () => {
    const session = new PlaySession(await options({ startServer: false }), new ScriptedIo());
    await expect(session.run()).rejects.toThrow(/No game server answers on ws:\/\/localhost:\d+/);
  });
});
