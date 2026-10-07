import { StubRoom } from "@partygame/game-client/testing";
import { TerminalPlayer } from "@partygame/terminal";
import { ScriptedIo } from "@partygame/terminal/testing";
import { describe, expect, it } from "vitest";
import { PHASE } from "../../src/phaseNames.js";
import { __PascalName__State } from "../../src/state.js";
import { __camelName__Terminal } from "../../terminal/__camelName__Terminal.js";
import { ME, seat, tick } from "./support.js";

const REFUSED = { ok: false, error: { code: "NOT_ALLOWED", message: "Not yet" } };

const setup = (role: "host" | "player" = "player") => {
  const state = new __PascalName__State();
  seat(state, ME, "Me", role);
  const room = new StubRoom(state);
  const io = new ScriptedIo();
  const player = new TerminalPlayer(room, ME, io, __camelName__Terminal());
  const finished = { value: false };
  player.run().then(() => {
    finished.value = true;
  });
  const enter = async (phase: string): Promise<void> => {
    await tick();
    io.asked.length = 0;
    io.signals.length = 0;
    state.phase = phase;
    room.patch();
    await tick();
  };
  const sent = () => room.requests.map((request) => request.payload);
  return { state, room, io, finished, enter, sent };
};

describe("__camelName__Terminal", () => {
  describe("waving", () => {
    it("asks to wave, sends WAVE and asks again with the fresh count", async () => {
      const { state, room, io, enter, sent } = setup();
      await enter(PHASE.Waving);
      expect(io.lastQuestion).toBe("You have waved 0 times. Enter to wave, q quits: ");
      await io.type("");
      expect(sent()).toEqual([{ type: "WAVE" }]);
      expect(io.printed).toContain("Waved!");
      state.waves.set(ME, 1);
      room.patch();
      await tick();
      expect(io.lastQuestion).toBe("You have waved 1 times. Enter to wave, q quits: ");
    });

    it("keeps asking when a wave is refused", async () => {
      const { room, io, enter, sent } = setup();
      await enter(PHASE.Waving);
      room.reply = REFUSED;
      await io.type("");
      expect(io.printed).toContain("Refused: Not yet");
      expect(sent()).toEqual([{ type: "WAVE" }]);
      expect(io.lastQuestion).toBe("You have waved 0 times. Enter to wave, q quits: ");
    });

    it("quits on the quit word", async () => {
      const { io, enter, finished } = setup();
      await enter(PHASE.Waving);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  describe("results", () => {
    it("announces the winner and lets the host play again or end the game", async () => {
      const { state, io, enter, sent } = setup("host");
      state.winnerName = "Me";
      state.winnerWaves = 3;
      await enter(PHASE.Results);
      expect(io.printed).toContain("Me wins with 3 waves!");
      expect(io.lastQuestion).toBe("[a]gain, [e]nd game or q to quit: ");
      await io.type("n");
      expect(sent()).toEqual([]);
      await io.type("a");
      expect(sent()).toEqual([{ type: "PLAY_AGAIN" }]);
    });

    it("announces an empty result and sends END_GAME on e", async () => {
      const { io, enter, sent } = setup("host");
      await enter(PHASE.Results);
      expect(io.printed).toContain("Nobody waved.");
      await io.type("e");
      expect(sent()).toEqual([{ type: "END_GAME" }]);
    });

    it("keeps asking when an action is refused", async () => {
      const { room, io, enter, sent } = setup("host");
      await enter(PHASE.Results);
      room.reply = REFUSED;
      await io.type("a");
      expect(io.asked).toHaveLength(2);
      expect(sent()).toEqual([{ type: "PLAY_AGAIN" }]);
    });

    it("lets a guest only wait or quit", async () => {
      const { state, io, enter, sent, finished } = setup();
      state.winnerName = "Someone";
      state.winnerWaves = 2;
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("Waiting for the host. q to quit: ");
      await io.type("a");
      expect(sent()).toEqual([]);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  it("asks nothing in a phase it does not know", async () => {
    const { io, enter } = setup();
    await enter("Mystery");
    expect(io.asked).toEqual([]);
  });
});
