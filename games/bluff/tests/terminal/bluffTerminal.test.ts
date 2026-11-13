import { StubRoom } from "@partygame/game-client/testing";
import { TerminalPlayer } from "@partygame/terminal";
import { ScriptedIo } from "@partygame/terminal/testing";
import { describe, expect, it } from "vitest";
import { PHASE } from "../../src/phaseNames.js";
import { BluffState, RevealEntry } from "../../src/state.js";
import { bluffTerminal } from "../../terminal/bluffTerminal.js";
import { choice, ME, mine, seat, tick } from "./support.js";

const REFUSED = { ok: false, error: { code: "NOT_ALLOWED", message: "Not yet" } };

const setup = (role: "host" | "player" = "player") => {
  const state = new BluffState();
  seat(state, ME, "Me", role);
  const room = new StubRoom(state);
  const io = new ScriptedIo();
  const player = new TerminalPlayer(room, ME, io, bluffTerminal(), { now: () => 10_000 });
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
  return { state, room, io, player, finished, enter, sent };
};

const voting = (state: BluffState): void => {
  state.choices.push(choice("a", "One"), choice("b", "Two"));
};

const revealed = (state: BluffState): void => {
  voting(state);
  state.truthRevealedId = "b";
  state.results.push(
    Object.assign(new RevealEntry(), {
      playerId: "p1",
      name: "Ann",
      roundPoints: 2,
      fooledCount: 1,
      guessedTruth: true,
    }),
    Object.assign(new RevealEntry(), {
      playerId: "p2",
      name: "Bob",
      roundPoints: 1,
      fooledCount: 0,
      guessedTruth: false,
    }),
  );
};

describe("bluffTerminal", () => {
  describe("writing", () => {
    it("asks for a fake once and sends it", async () => {
      const { state, io, enter, sent } = setup();
      state.promptText = "How many hearts does an octopus have?";
      state.serverNow = 10_000;
      state.phaseEndsAt = 40_000;
      await enter(PHASE.Writing);
      expect(io.lastQuestion).toBe(
        "Write a fake answer for: How many hearts does an octopus have? 30s left (/q quits): ",
      );
      await io.type("The moon");
      expect(sent()).toEqual([{ text: "The moon", type: "SUBMIT_FAKE" }]);
      expect(io.printed).toContain("Fake sent.");
      expect(io.printed).toContain("Waiting for the others...");
    });

    it("keeps asking on an empty answer and when the fake is refused", async () => {
      const { state, io, room, enter } = setup();
      state.promptText = "Q?";
      await enter(PHASE.Writing);
      await io.type("   ");
      expect(io.asked).toHaveLength(2);
      room.reply = REFUSED;
      await io.type("Bad word");
      expect(io.printed).toContain("Refused: Not yet");
      room.reply = { ok: true };
      await io.type("Fine");
      expect(io.printed).toContain("Fake sent.");
    });

    it("quits on /q", async () => {
      const { state, io, enter, finished } = setup();
      state.promptText = "Q?";
      await enter(PHASE.Writing);
      await io.type("/q");
      expect(finished.value).toBe(true);
    });

    it("waits without re-asking when the state changes after submitting", async () => {
      const { state, room, io, enter } = setup();
      state.promptText = "Q?";
      await enter(PHASE.Writing);
      await io.type("The moon");
      expect(io.printed).toContain("Waiting for the others...");
      state.serverNow += 1000;
      room.patch();
      await tick();
      expect(io.asked).toHaveLength(1);
      expect(io.printed.filter((line) => line === "Waiting for the others...")).toHaveLength(1);
    });

    it("stops waiting when the phase changes after submitting", async () => {
      const { state, io, enter } = setup();
      state.promptText = "Q?";
      await enter(PHASE.Writing);
      await io.type("The moon");
      expect(io.printed).toContain("Waiting for the others...");
      const first = io.signals[0];
      await enter(PHASE.Reveal);
      expect(first?.aborted).toBe(true);
      expect(io.printed.some((line) => line.startsWith("Something went wrong"))).toBe(false);
    });
  });

  describe("voting", () => {
    it("lists the options, refuses its own and votes by number", async () => {
      const { state, io, enter, sent } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a" });
      await enter(PHASE.Voting);
      expect(io.printed).toContain("  1) One");
      expect(io.printed).toContain("  2) Two");
      expect(io.lastQuestion).toBe("Vote for the real one, 1-2, q to quit: ");
      await io.type("1");
      expect(io.printed).toContain("You cannot vote for your own answer.");
      await io.type("9");
      expect(io.printed).toContain("Enter a number from 1 to 2.");
      await io.type("2");
      expect(sent()).toEqual([{ optionId: "b", type: "CAST_VOTE" }]);
      expect(io.printed).toContain('Voted for "Two".');
      expect(io.printed).toContain("Waiting for the others...");
    });

    it("waits when it already voted", async () => {
      const { state, room, io, enter } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a", myVote: "b" });
      await enter(PHASE.Voting);
      expect(io.asked).toEqual([]);
      expect(io.printed).toContain("Waiting for the others...");
      // A state change while waiting re-enters the wait without re-printing.
      state.votesCast = 1;
      room.patch();
      await tick();
      expect(io.asked).toEqual([]);
      expect(io.printed.filter((line) => line === "Waiting for the others...")).toHaveLength(1);
    });

    it("votes when its private view has no entry", async () => {
      const { state, io, enter, sent } = setup();
      voting(state);
      await enter(PHASE.Voting);
      await io.type("1");
      expect(sent()).toEqual([{ optionId: "a", type: "CAST_VOTE" }]);
      expect(io.printed).toContain('Voted for "One".');
    });

    it("keeps waiting without re-asking once its vote is in", async () => {
      const { state, room, io, enter } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a" });
      await enter(PHASE.Voting);
      await io.type("2");
      expect(io.printed).toContain('Voted for "Two".');
      // The server records the vote in the private view; the wake must not re-ask.
      mine(state, ME, { myOptionId: "a", myVote: "b" });
      room.patch();
      await tick();
      expect(io.asked).toHaveLength(1);
      expect(io.printed.filter((line) => line === "Waiting for the others...")).toHaveLength(1);
    });

    it("stops waiting when the phase changes after voting", async () => {
      const { state, io, enter } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a" });
      await enter(PHASE.Voting);
      await io.type("2");
      expect(io.printed).toContain('Voted for "Two".');
      const first = io.signals[0];
      await enter(PHASE.Reveal);
      expect(first?.aborted).toBe(true);
      expect(io.printed.some((line) => line.startsWith("Something went wrong"))).toBe(false);
    });

    it("keeps asking when a vote is refused", async () => {
      const { state, io, room, enter } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a" });
      await enter(PHASE.Voting);
      room.reply = REFUSED;
      await io.type("2");
      expect(io.printed).toContain("Refused: Not yet");
      expect(io.asked).toHaveLength(2);
    });

    it("waits when there is nothing to vote on", async () => {
      const { state, room, io, enter } = setup();
      await enter(PHASE.Voting);
      expect(io.asked).toEqual([]);
      expect(io.printed).toContain("Nothing to vote on.");
      // A state change wakes the wait and ends the stage without ever asking.
      state.votesCast = 1;
      room.patch();
      await tick();
      expect(io.asked).toEqual([]);
    });

    it("quits on q", async () => {
      const { state, io, enter, finished } = setup();
      voting(state);
      mine(state, ME, { myOptionId: "a" });
      await enter(PHASE.Voting);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  describe("reveal", () => {
    it("prints the truth and each player's points", async () => {
      const { state, io, enter } = setup();
      revealed(state);
      await enter(PHASE.Reveal);
      expect(io.asked).toEqual([]);
      expect(io.printed).toContain("The truth was: Two");
      expect(io.printed).toContain("  Ann: 2 points");
      expect(io.printed).toContain("  Bob: 1 point");
    });

    it("waits for the reveal when it arrives after the phase", async () => {
      const { state, io, room, enter } = setup();
      await enter(PHASE.Reveal);
      expect(io.printed).not.toContain("The truth was: Two");
      revealed(state);
      room.patch();
      await tick();
      expect(io.printed).toContain("The truth was: Two");
    });

    it("prints a marker when the truth option is missing", async () => {
      const { state, io, enter } = setup();
      state.truthRevealedId = "gone";
      await enter(PHASE.Reveal);
      expect(io.printed).toContain("The truth was: ?");
    });

    it("stops waiting when the phase changes before the reveal", async () => {
      const { io, enter } = setup();
      await enter(PHASE.Reveal);
      expect(io.printed).not.toContain("The truth was: Two");
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("Waiting for the host. q to quit: ");
      expect(io.printed).not.toContain("The truth was: Two");
    });
  });

  describe("results", () => {
    it("offers the host play again and end game, and ignores other keys", async () => {
      const { io, enter, sent } = setup("host");
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("[a]gain, [e]nd game or q to quit: ");
      await io.type("x");
      expect(io.asked).toHaveLength(2);
      await io.type("A");
      expect(sent()).toEqual([{ type: "PLAY_AGAIN" }]);
    });

    it("sends END_GAME on e and keeps asking when it is refused", async () => {
      const { io, room, enter, sent } = setup("host");
      await enter(PHASE.Results);
      room.reply = REFUSED;
      await io.type("e");
      expect(io.asked).toHaveLength(2);
      expect(sent()).toEqual([{ type: "END_GAME" }]);
    });

    it("lets a guest only wait or quit", async () => {
      const { io, enter, sent, finished } = setup();
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("Waiting for the host. q to quit: ");
      await io.type("a");
      expect(sent()).toEqual([]);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  describe("moving on", () => {
    it("drops the pending question when the phase changes", async () => {
      const { state, io, enter } = setup();
      state.promptText = "Q?";
      await enter(PHASE.Writing);
      const first = io.signals[0];
      await enter(PHASE.Voting);
      expect(first?.aborted).toBe(true);
      expect(io.printed.some((line) => line.startsWith("Something went wrong"))).toBe(false);
      expect(io.asked).toEqual([]);
    });

    it("asks nothing for a phase it does not play", async () => {
      const { io, enter } = setup();
      await enter("Bogus");
      expect(io.asked).toEqual([]);
    });
  });
});
