import { ServerProbe } from "@partygame/server/node";
import { PlaySession, type PlaySessionOptions, TerminalPlayer } from "@partygame/terminal";
import { ScriptedIo } from "@partygame/terminal/testing";
import { afterEach, describe, expect, it } from "vitest";
import { witClashKit } from "../../bots/witClashBot.js";
import { witClashGame } from "../../src/hostedGame.js";
import type { WitClashState } from "../../src/state.js";
import { witClashTerminal } from "../../terminal/witClashTerminal.js";
import { makeCategories } from "../game/support.js";
import { freePort } from "./support.js";

class ViteUp extends ServerProbe {
  override async answers(): Promise<boolean> {
    return true;
  }
}

const options = async (): Promise<PlaySessionOptions<WitClashState>> => ({
  name: "Ann",
  bots: 3,
  join: undefined,
  endpoint: `ws://localhost:${await freePort()}`,
  apiPort: await freePort(),
  startServer: true,
  clientUrl: "http://localhost:5173",
  kit: witClashKit(),
  games: [witClashGame(makeCategories(4, 8, 2))],
  player: (room, playerId, io) => new TerminalPlayer(room, playerId, io, witClashTerminal()),
  roomOptions: { totalRounds: 1, categoryVoteSeconds: 5, voteSeconds: 5, revealSeconds: 1 },
  bot: { thinkMs: [0, 30], reactMs: [0, 30] },
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

const sessions: Array<PlaySession<WitClashState>> = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});

describe("PlaySession with WitClash", () => {
  it("hosts a room with three bots and plays one round to the final results", async () => {
    const io = new ScriptedIo();
    const session = new PlaySession(await options(), io, new ViteUp());
    sessions.push(session);
    const running = session.run();
    await drive(io, running);
    await running;

    const said = io.printed.join("\n");
    expect(said).toMatch(/Room [A-Z]{4} \(you are the host\)/);
    expect(said).toContain("Bot 1 joined.");
    expect(said).toContain("=== Final scores ===");
    expect(said).toMatch(/Winners? ?(\(shared\))?: /);
  }, 60_000);
});
