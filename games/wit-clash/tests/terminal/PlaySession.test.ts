import { afterEach, describe, expect, it } from "vitest";
import { GameClient } from "../../terminal/GameClient.js";
import { GameServerHandle } from "../../terminal/GameServerHandle.js";
import { type PlayOptions, PlaySession } from "../../terminal/PlaySession.js";
import { ServerProbe } from "../../terminal/ServerProbe.js";
import { makeCategories } from "../game/support.js";
import { freePort, ScriptedIo, tick } from "./support.js";

const FAST = {
  thinkMs: [0, 30],
  reactMs: [0, 30],
} as const;

class ViteUp extends ServerProbe {
  override async answers(): Promise<boolean> {
    return true;
  }
}

const options = async (over: Partial<PlayOptions> = {}): Promise<PlayOptions> => ({
  name: "Ann",
  bots: 0,
  join: undefined,
  endpoint: `ws://localhost:${await freePort()}`,
  apiPort: await freePort(),
  startServer: true,
  categories: makeCategories(4, 8, 2),
  clientUrl: "http://localhost:5173",
  roomOptions: { totalRounds: 1, categoryVoteSeconds: 5, voteSeconds: 5, revealSeconds: 1 },
  bot: FAST,
  ...over,
});

const answerFor = (question: string, printed: string[]): string | undefined => {
  if (question.startsWith("Press Enter to start"))
    return printed.includes("Bot 3 joined.") ? "" : undefined;
  if (question.startsWith("Vote for a category")) return "1";
  if (question.includes("Your answer")) return "A human answer";
  if (question.startsWith("Vote for 1-")) return "1";
  if (question.includes("[a]gain")) return "q";
  return undefined;
};

const drive = async (io: ScriptedIo, running: Promise<void>): Promise<void> => {
  let over = false;
  running.finally(() => {
    over = true;
  });
  while (!over) {
    const reply = io.isWaiting ? answerFor(io.lastQuestion, io.printed) : undefined;
    if (reply !== undefined) await io.type(reply);
    else await new Promise((resolve) => setTimeout(resolve, 30));
  }
};

const sessions: PlaySession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});

describe("PlaySession", () => {
  it("starts a server, hosts a room with three bots and plays one round to the final results", async () => {
    const io = new ScriptedIo();
    const session = new PlaySession(await options({ bots: 3 }), io, new ViteUp());
    sessions.push(session);
    const running = session.run();
    await drive(io, running);
    await running;

    const said = io.printed.join("\n");
    expect(said).toMatch(/Started a game server on ports \d+ and \d+/);
    expect(said).toMatch(/Room [A-Z]{4} \(you are the host\)/);
    expect(said).toMatch(/Browser players can join at http:\/\/localhost:5173\/\?code=[A-Z]{4}/);
    expect(said).toMatch(/TV view: http:\/\/localhost:5173\/\?tv=[A-Z]{4}/);
    expect(said).toContain("Bot 1 joined.");
    expect(said).toContain("=== Final scores ===");
    expect(said).toMatch(/Winners? ?(\(shared\))?: /);
  }, 60_000);

  it("joins a room on a running server as a plain player and can quit", async () => {
    const handle = new GameServerHandle(makeCategories());
    await handle.start();
    try {
      const host = await new GameClient(handle.endpoint, handle.apiPort).create(
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
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(io.printed).toContain(`Joined room ${host.state.roomCode}`);
      expect(io.printed.some((line) => line.startsWith("Browser players"))).toBe(false);
      expect(io.printed.some((line) => line.startsWith("Using the game server"))).toBe(true);
      await io.type("q");
      await running;
      await host.leave(true);
    } finally {
      await handle.stop();
    }
  });

  it("stops when asked before the player is up, and when it is mid-game", async () => {
    const early = new PlaySession(await options(), new ScriptedIo(), new ViteUp());
    early.stop();
    await early.run();

    const io = new ScriptedIo();
    const session = new PlaySession(await options(), io);
    const running = session.run();
    while (!io.isWaiting) await tick();
    session.stop();
    await running;
  });

  it("reports a missing server instead of starting one when told not to", async () => {
    const session = new PlaySession(await options({ startServer: false }), new ScriptedIo());
    await expect(session.run()).rejects.toThrow(/No game server answers on ws:\/\/localhost:\d+/);
  });
});
