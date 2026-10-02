import { StubRoom } from "@partygame/game-client/testing";
import { describe, expect, it } from "vitest";
import { PHASE } from "../../src/phaseNames.js";
import { WitClashState } from "../../src/state.js";
import { TerminalPlayer } from "../../terminal/TerminalPlayer.js";
import { answer, ME, matchup, mine, option, prompt, ScriptedIo, seat, tick } from "./support.js";

const REFUSED = { ok: false, error: { code: "NOT_ALLOWED", message: "Not yet" } };

const setup = (role: "host" | "player" = "player") => {
  const state = new WitClashState();
  seat(state, ME, "Me", role);
  const room = new StubRoom(state);
  const io = new ScriptedIo();
  let clock = 10_000;
  const player = new TerminalPlayer(room, ME, io, { now: () => clock });
  const finished = { value: false };
  player.run().then(() => {
    finished.value = true;
  });
  const enter = async (phase: string, round = 1): Promise<void> => {
    await tick();
    io.asked.length = 0;
    io.signals.length = 0;
    state.phase = phase;
    state.roundNumber = round;
    room.patch();
    await tick();
  };
  const sent = () => room.requests.map((request) => request.payload);
  return { state, room, io, player, finished, enter, sent, advance: (ms: number) => (clock += ms) };
};

describe("TerminalPlayer", () => {
  describe("lobby", () => {
    it("lets the host start the game and tells the server's refusal", async () => {
      const { io, room, sent } = setup("host");
      await tick();
      expect(io.lastQuestion).toBe("Press Enter to start the game, or q to quit: ");
      room.reply = REFUSED;
      await io.type("");
      expect(io.printed).toContain("Refused: Not yet");
      expect(io.asked).toHaveLength(2);
      room.reply = { ok: true };
      await io.type("");
      expect(sent()).toEqual([{ type: "START_GAME" }, { type: "START_GAME" }]);
      expect(io.printed).toContain("Starting...");
      expect(io.asked).toHaveLength(2);
    });

    it("keeps a guest waiting, and anyone can quit", async () => {
      const { io, finished, sent } = setup();
      await tick();
      expect(io.lastQuestion).toBe("Waiting for the host to start. Type q to quit: ");
      await io.type("hello");
      expect(io.asked).toHaveLength(2);
      expect(sent()).toEqual([]);
      await io.type("Q");
      expect(finished.value).toBe(true);
    });
  });

  describe("category selection", () => {
    it("asks for a number, rejects nonsense, votes and lets you change your mind", async () => {
      const { state, io, enter, sent, advance } = setup();
      state.categoryOptions.push(option("a"), option("b"));
      state.serverNow = 10_000;
      state.phaseEndsAt = 40_000;
      await enter(PHASE.CategorySelection);
      advance(5000);
      expect(io.printed).toContain("  2) Name b");
      await io.type("9");
      expect(io.printed).toContain("Enter a number from 1 to 2.");
      await io.type("2");
      expect(sent()).toEqual([{ categoryId: "b", type: "VOTE_CATEGORY" }]);
      expect(io.printed).toContain("Voted for Name b.");
      expect(io.lastQuestion).toBe("Vote for a category, 1-2 25s left, q to quit: ");
    });

    it("quits on q", async () => {
      const { io, enter, finished } = setup();
      await enter(PHASE.CategorySelection);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  describe("answering", () => {
    it("asks each prompt in turn, flags typing and keeps a refused prompt open", async () => {
      const { state, io, room, enter, sent } = setup();
      mine(state, ME, {}, [prompt("m1", "First?"), prompt("m2", "Second?")]);
      await enter(PHASE.Prompting);
      expect(io.lastQuestion).toBe("Prompt: First?\nYour answer (/q quits): ");
      expect(sent()).toEqual([{ type: "SET_TYPING", typing: true }]);
      await io.type("   ");
      expect(io.asked).toHaveLength(2);
      room.reply = REFUSED;
      await io.type("Nope");
      expect(io.printed).toContain("Refused: Not yet");
      expect(io.lastQuestion).toContain("First?");
      room.reply = { ok: true };
      await io.type(" Yes ");
      expect(io.printed).toContain("Answer sent.");
      expect(sent().at(-1)).toEqual({ matchupId: "m1", answer: "Yes", type: "SUBMIT_ANSWER" });
      expect(io.lastQuestion).toContain("Second?");
    });

    it("waits when there is nothing to answer, then asks once prompts arrive", async () => {
      const { state, io, room, enter } = setup();
      await enter(PHASE.TieBreakerPrompting);
      expect(io.printed.filter((line) => line === "Waiting for the others...")).toHaveLength(1);
      expect(io.asked).toEqual([]);
      room.patch();
      await tick();
      expect(io.printed.filter((line) => line === "Waiting for the others...")).toHaveLength(1);
      mine(state, ME, {}, [prompt("t1", "Tie?")]);
      room.patch();
      await tick();
      expect(io.lastQuestion).toContain("Tie?");
    });

    it("waits after the last prompt is answered, and skips prompts already submitted", async () => {
      const { state, io, enter } = setup();
      mine(state, ME, {}, [prompt("m1", "Done?", true), prompt("m2", "Open?")]);
      await enter(PHASE.Prompting);
      expect(io.lastQuestion).toContain("Open?");
      await io.type("Fine");
      expect(io.printed).toContain("Waiting for the others...");
    });

    it("quits on /q and survives a failing request", async () => {
      const { state, io, room, enter, finished } = setup();
      mine(state, ME, {}, [prompt("m1", "First?")]);
      await enter(PHASE.Prompting);
      room.request = async () => {
        throw new Error("socket closed");
      };
      await io.type("Hi");
      expect(io.printed).toContain("Could not send that: Error: socket closed");
      await io.type("/q");
      expect(finished.value).toBe(true);
    });

    it("tells an unexpected reply", async () => {
      const { state, io, room, enter } = setup();
      mine(state, ME, {}, [prompt("m1", "First?")]);
      await enter(PHASE.Prompting);
      room.reply = "what";
      await io.type("Hi");
      expect(io.printed).toContain("The server sent an unexpected reply.");
    });
  });

  describe("voting", () => {
    const voting = (state: WitClashState) => {
      state.matchups.push(matchup("m1", "Why?", [answer("a1", "One"), answer("a2", "Two")]));
      state.activeMatchupIndex = 0;
    };

    it("votes by number and can change its vote", async () => {
      const { state, io, enter, sent } = setup();
      voting(state);
      mine(state, ME, { canVote: true });
      await enter(PHASE.MatchupVoting);
      await io.type("x");
      expect(io.printed).toContain("Enter a number from 1 to 2.");
      await io.type("1");
      expect(sent()).toEqual([{ answerId: "a1", type: "CAST_VOTE" }]);
      expect(io.printed).toContain('Voted for "One".');
      expect(io.lastQuestion).toBe("Vote for 1-2, q to quit: ");
      await io.type("q");
    });

    it("waits when you are in the matchup", async () => {
      const { state, io, room, enter } = setup();
      voting(state);
      mine(state, ME, { isOwnMatchup: true });
      await enter(PHASE.MatchupVoting);
      const note = "You are in this one, so you wait while the others vote.";
      room.patch();
      await tick();
      expect(io.printed.filter((line) => line === note)).toHaveLength(1);
      expect(io.asked).toEqual([]);
    });

    it("waits when you cannot vote for another reason, then votes once allowed", async () => {
      const { state, io, room, enter } = setup();
      voting(state);
      await enter(PHASE.MatchupVoting);
      expect(io.printed).toContain("You cannot vote on this one, so you wait.");
      mine(state, ME, { canVote: true });
      room.patch();
      await tick();
      expect(io.lastQuestion).toContain("Vote for 1-2");
    });

    it("votes on the latest tie-breaker", async () => {
      const { state, io, enter, sent } = setup();
      state.tieBreakers.push(matchup("t0", "Old?", [answer("o1", "Old")]));
      state.tieBreakers.push(matchup("t1", "Tie?", [answer("x1", "Ex"), answer("x2", "Why")]));
      mine(state, ME, { canVote: true });
      await enter(PHASE.TieBreakerVoting);
      await io.type("2");
      expect(sent()).toEqual([{ answerId: "x2", type: "CAST_VOTE" }]);
    });

    it("reports a matchup that is missing instead of crashing", async () => {
      const { io, enter } = setup();
      await enter(PHASE.MatchupVoting);
      expect(io.printed).toContain("Something went wrong: Error: Missing matchup");
    });
  });

  describe("results", () => {
    it("offers the host the next round and sends it", async () => {
      const { state, io, enter, sent } = setup("host");
      state.isFinalRound = false;
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("[n]ext round, [e]nd game or [q]uit: ");
      await io.type("a");
      await io.type("n");
      expect(sent()).toEqual([{ type: "NEXT_ROUND" }]);
    });

    it("offers the host play again and end after the final round", async () => {
      const { state, io, enter, sent } = setup("host");
      state.isFinalRound = true;
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("[a]gain, [e]nd game or [q]uit: ");
      await io.type("n");
      await io.type("a");
      expect(sent()).toEqual([{ type: "PLAY_AGAIN" }]);
    });

    it("sends END_GAME on e and keeps asking when it is refused", async () => {
      const { state, io, room, enter, sent } = setup("host");
      state.isFinalRound = true;
      await enter(PHASE.Results);
      room.reply = REFUSED;
      await io.type("e");
      expect(io.asked).toHaveLength(2);
      expect(sent()).toEqual([{ type: "END_GAME" }]);
    });

    it("lets a guest only wait or quit", async () => {
      const { io, enter, sent, finished } = setup();
      await enter(PHASE.Results);
      expect(io.lastQuestion).toBe("Waiting for the host. [q]uit: ");
      await io.type("n");
      expect(sent()).toEqual([]);
      await io.type("q");
      expect(finished.value).toBe(true);
    });
  });

  describe("moving on", () => {
    it("drops the pending question when the phase changes", async () => {
      const { state, io, enter } = setup();
      state.categoryOptions.push(option("a"));
      await enter(PHASE.CategorySelection);
      const first = io.signals[0];
      await enter(PHASE.MatchupReveal);
      expect(first?.aborted).toBe(true);
      expect(io.printed.some((line) => line.startsWith("Something went wrong"))).toBe(false);
      expect(io.asked).toEqual([]);
    });

    it("asks again for each matchup of the same round", async () => {
      const { state, io, room, enter } = setup();
      mine(state, ME, { canVote: true });
      state.matchups.push(matchup("m1", "A?", [answer("a1", "x")]));
      state.matchups.push(matchup("m2", "B?", [answer("b1", "y")]));
      state.activeMatchupIndex = 0;
      await enter(PHASE.MatchupVoting);
      state.activeMatchupIndex = 1;
      room.patch();
      await tick();
      expect(io.asked).toHaveLength(2);
    });

    it("prints narration as the game moves", async () => {
      const { state, io, enter } = setup();
      state.categoryOptions.push(option("a"));
      await enter(PHASE.CategorySelection);
      expect(io.printed).toContain("=== Round 1 of 3 ===");
    });

    it("stops and says so when the room is gone", async () => {
      const { room, io, finished, state } = setup();
      await tick();
      await room.leave();
      expect(io.printed).toContain("You have left the room.");
      expect(finished.value).toBe(true);
      state.phase = PHASE.Results;
      room.patch();
      expect(io.printed.filter((line) => line.includes("Scores"))).toEqual([]);
    });

    it("reads the real clock when none is injected", async () => {
      const state = new WitClashState();
      seat(state, ME, "Me");
      const room = new StubRoom(state);
      const io = new ScriptedIo();
      state.serverNow = Date.now();
      state.phaseEndsAt = Date.now() + 30_000;
      state.phase = PHASE.CategorySelection;
      state.categoryOptions.push(option("a"));
      new TerminalPlayer(room, ME, io).run();
      await tick();
      expect(io.lastQuestion).toMatch(/1-1 (29|30)s left/);
    });

    it("shows nothing to ask during a reveal", async () => {
      const { io, enter } = setup();
      await enter(PHASE.TieBreakerReveal);
      expect(io.asked).toEqual([]);
    });
  });
});
