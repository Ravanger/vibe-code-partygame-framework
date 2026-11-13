import { ServerProbe } from "@partygame/server/probe";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@partygame/shared";
import { PlaySession, type PlaySessionOptions, TerminalPlayer } from "@partygame/terminal";
import { ScriptedIo } from "@partygame/terminal/testing";
import { afterEach, describe, expect, it } from "vitest";
import { bluffKit } from "../../bots/bluffBot.js";
import { gamePackage } from "../../gamePackage.js";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { META } from "../../src/meta.js";
import { BLUFF_PUBLIC_FIELDS, BluffState } from "../../src/state.js";
import { bluffTerminal } from "../../terminal/bluffTerminal.js";
import { freePort } from "./support.js";

class ViteUp extends ServerProbe {
  override async answers(): Promise<boolean> {
    return true;
  }
}

const HUMAN_FAKE = "A human fake";

const options = async (): Promise<PlaySessionOptions<BluffState>> => ({
  name: "Ann",
  bots: 3,
  join: undefined,
  endpoint: `ws://localhost:${await freePort()}`,
  apiPort: await freePort(),
  startServer: true,
  clientUrl: "http://localhost:5173",
  kit: bluffKit(),
  games: [
    {
      roomName: META.roomName,
      definition: gamePackage.definition(
        promptsFromArray([
          { id: "p1", question: "Q one?", truth: "T one" },
          { id: "p2", question: "Q two?", truth: "T two" },
          { id: "p3", question: "Q three?", truth: "T three" },
        ]),
      ),
      stateClass: BluffState,
      publicFields: BLUFF_PUBLIC_FIELDS,
    },
  ],
  player: (room, playerId, io) => new TerminalPlayer(room, playerId, io, bluffTerminal()),
  // The shortest phases the option schema allows keep the whole game under a minute even when
  // two bots draw the same fake and one of them is refused without retrying, which lets Writing
  // run out its clock.
  roomOptions: { rounds: 1, writingSeconds: 10, votingSeconds: 5, revealSeconds: 2 },
  bot: { thinkMs: [0, 30], reactMs: [0, 30] },
});

/** A number from the printed option list that is not the human's own fake. */
const voteNumber = (printed: string[]): string | undefined => {
  const lines = printed.filter((line) => /^\s*\d+\) /.test(line));
  if (lines.length < 2) return undefined;
  const ownIndex = lines.findIndex((line) => line.includes(HUMAN_FAKE));
  return lines[(ownIndex + 1) % lines.length]?.match(/\d+/)?.[0];
};

const answerFor = (question: string, printed: string[]): string | undefined => {
  if (question.startsWith("Press Enter to start"))
    return printed.includes("Bot 3 joined.") ? "" : undefined;
  if (question.startsWith("Write a fake answer for:")) return HUMAN_FAKE;
  if (question.startsWith("Vote for the real one")) return voteNumber(printed);
  if (question.startsWith("[a]gain")) return "q";
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

const sessions: Array<PlaySession<BluffState>> = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});

describe("PlaySession with Bluff", () => {
  it("hosts a room with three bots and plays one round to the results", async () => {
    const io = new ScriptedIo();
    const session = new PlaySession(await options(), io, new ViteUp());
    sessions.push(session);
    const running = session.run();
    await drive(io, running);
    await running;

    const said = io.printed.join("\n");
    expect(said).toMatch(
      new RegExp(`Room [${ROOM_CODE_ALPHABET}]` + `{${ROOM_CODE_LENGTH}} \\(you are the host\\)`),
    );
    expect(said).toContain("Bot 1 joined.");
    expect(said).toContain("Fake sent.");
    expect(said).toContain('Voted for "');
    expect(said).toContain("The truth was: ");
    expect(io.asked.some((question) => question.startsWith("[a]gain, [e]nd game"))).toBe(true);
  }, 60_000);
});
