import { type SchemaType, t } from "@colyseus/schema";
import type { BotRoom } from "@partygame/bots";
import { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { TerminalPlayer, type TerminalStrategy, type TerminalTurn } from "../src/index.js";
import { ScriptedIo } from "../src/testing.js";

const ToyState = BaseGameState.extend({ step: t.number().default(0) }, "ToyState");
type ToyState = SchemaType<typeof ToyState>;

const ME = "me-0000001";
const REFUSED = { ok: false, error: { code: "NOT_ALLOWED", message: "Not yet" } };

class FakeRoom implements BotRoom<ToyState> {
  readonly state = new ToyState();
  readonly requests: object[] = [];
  readonly listeners: Array<() => void> = [];
  readonly leavers: Array<() => void> = [];
  reply: () => Promise<unknown> = async () => ({ ok: true });

  onStateChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  onLeave(callback: () => void): void {
    this.leavers.push(callback);
  }

  request(_type: string, payload: object): Promise<unknown> {
    this.requests.push(payload);
    return this.reply();
  }

  async leave(): Promise<void> {}

  patch(): void {
    for (const listener of this.listeners) listener();
  }

  close(): void {
    for (const leaver of this.leavers) leaver();
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (
  strategy: TerminalStrategy<ToyState>,
  role: "host" | "player" = "player",
  options: { now?: () => number; quitWord?: string } = {},
) => {
  const room = new FakeRoom();
  room.state.players.set(ME, Object.assign(new PlayerSchema(), { id: ME, name: "Me", role }));
  const io = new ScriptedIo();
  const player = new TerminalPlayer(room, ME, io, strategy, options);
  const finished = { value: false };
  player.run().then(() => {
    finished.value = true;
  });
  return { room, io, player, finished, sent: () => room.requests };
};

const idle: TerminalStrategy<ToyState> = { play: async () => {} };

describe("TerminalPlayer", () => {
  describe("stages", () => {
    it("starts a stage per phase by default and aborts the pending question on change", async () => {
      const { room, io } = setup({
        play: (turn) => turn.ask(`In ${turn.state.phase}?`).then(() => {}),
      });
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.asked.at(-1)).toBe("In One?");
      const first = io.signals[0];
      const count = io.asked.length;
      room.patch();
      await tick();
      expect(io.asked).toHaveLength(count);
      room.state.phase = "Two";
      room.patch();
      await tick();
      expect(first?.aborted).toBe(true);
      expect(io.lastQuestion).toBe("In Two?");
      expect(io.printed).toEqual([]);
    });

    it("uses stageOf to split a phase into stages", async () => {
      const { room, io } = setup({
        play: (turn) => turn.ask("?").then(() => {}),
        stageOf: (state) => `${state.phase}:${state.step}`,
      });
      room.state.phase = "One";
      room.patch();
      await tick();
      const count = io.asked.length;
      room.state.step = 1;
      room.patch();
      await tick();
      expect(io.asked).toHaveLength(count + 1);
    });

    it("prints narration lines in order before the question", async () => {
      const { room, io } = setup({
        play: (turn) => turn.ask("?").then(() => {}),
        narrate: (state) => [`a ${state.phase}`, `b ${state.phase}`],
      });
      await tick();
      io.printed.length = 0;
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toEqual(["a One", "b One"]);
      expect(io.lastQuestion).toBe("?");
    });

    it("trims answers and exposes state, player and role", async () => {
      let seen: TerminalTurn<ToyState> | undefined;
      let answer = "";
      const { room, io } = setup(
        {
          play: async (turn) => {
            seen = turn;
            answer = await turn.ask("?");
          },
        },
        "host",
      );
      room.state.phase = "One";
      room.patch();
      await tick();
      await io.type("  hi  ");
      expect(answer).toBe("hi");
      expect(seen?.state).toBe(room.state);
      expect(seen?.playerId).toBe(ME);
      expect(seen?.isHost).toBe(true);
    });

    it("prints lines from a stage", async () => {
      const { room, io } = setup({
        play: async (turn) => turn.print("hello from the stage"),
      });
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toContain("hello from the stage");
    });

    it("reports a strategy that throws before returning a promise", async () => {
      const { room, io } = setup({
        play: () => {
          throw new Error("sync boom");
        },
      });
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toContain("Something went wrong: Error: sync boom");
    });

    it("reports a stage that throws, unless it was aborted", async () => {
      const { room, io } = setup({
        play: async (turn) => {
          if (turn.state.phase === "Bad") throw new Error("boom");
          await turn.ask("?");
        },
      });
      room.state.phase = "Bad";
      room.patch();
      await tick();
      expect(io.printed).toContain("Something went wrong: Error: boom");
      io.printed.length = 0;
      room.state.phase = "Good";
      room.patch();
      await tick();
      room.state.phase = "Next";
      room.patch();
      await tick();
      expect(io.printed.some((line) => line.startsWith("Something went wrong"))).toBe(false);
    });

    it("waits in changed() until the state changes or the stage ends", async () => {
      const woke: string[] = [];
      const { room } = setup({
        play: async (turn) => {
          await turn.changed();
          woke.push("changed");
          await turn.changed();
          woke.push("aborted");
        },
      });
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(woke).toEqual([]);
      room.patch();
      await tick();
      expect(woke).toEqual(["changed"]);
      room.state.phase = "Two";
      room.patch();
      await tick();
      expect(woke).toEqual(["changed", "aborted"]);
    });
  });

  describe("lobby", () => {
    it("lets the host start the game and prints the server's refusal", async () => {
      const { io, room, sent } = setup(idle, "host");
      await tick();
      expect(io.lastQuestion).toBe("Press Enter to start the game, or q to quit: ");
      room.reply = async () => REFUSED;
      await io.type("");
      expect(io.printed).toContain("Refused: Not yet");
      expect(io.asked).toHaveLength(2);
      room.reply = async () => ({ ok: true });
      await io.type("");
      expect(sent()).toEqual([{ type: "START_GAME" }, { type: "START_GAME" }]);
      expect(io.printed).toContain("Starting...");
      expect(io.asked).toHaveLength(2);
    });

    it("keeps a guest waiting, and anyone can quit", async () => {
      const { io, finished, sent } = setup(idle);
      await tick();
      expect(io.lastQuestion).toBe("Waiting for the host to start. Type q to quit: ");
      await io.type("hello");
      expect(io.asked).toHaveLength(2);
      expect(sent()).toEqual([]);
      await io.type("Q");
      expect(finished.value).toBe(true);
    });

    it("honours another quit word", async () => {
      const { io, finished } = setup(idle, "player", { quitWord: "bye" });
      await tick();
      expect(io.lastQuestion).toBe("Waiting for the host to start. Type bye to quit: ");
      await io.type("bye");
      expect(finished.value).toBe(true);
    });

    it("treats an uppercase quit word as lowercase and tells the stage", async () => {
      let word = "";
      const { io, finished } = setup(
        {
          play: async () => {},
          lobby: async (turn) => {
            word = turn.quitWord;
            await turn.ask("?");
          },
        },
        "player",
        { quitWord: "BYE" },
      );
      await tick();
      expect(word).toBe("bye");
      expect(finished.value).toBe(false);
      expect(io.lastQuestion).toBe("?");
    });

    it("quits the built-in lobby on an uppercase quit word option", async () => {
      const { io, finished } = setup(idle, "player", { quitWord: "BYE" });
      await tick();
      await io.type("bye");
      expect(finished.value).toBe(true);
    });

    it("lets the strategy replace the lobby and never calls play there", async () => {
      let played = 0;
      const { io } = setup({
        play: async () => {
          ++played;
        },
        lobby: (turn) => turn.ask("Custom lobby?").then(() => {}),
      });
      await tick();
      expect(io.lastQuestion).toBe("Custom lobby?");
      expect(played).toBe(0);
    });

    it("runs play outside the lobby", async () => {
      let phase = "";
      const { room } = setup({
        play: async (turn) => {
          phase = turn.state.phase;
        },
      });
      room.state.phase = "Play";
      room.patch();
      await tick();
      expect(phase).toBe("Play");
    });
  });

  describe("clock", () => {
    const clockStrategy = (left: string[]): TerminalStrategy<ToyState> => ({
      play: async (turn) => {
        left.push(turn.timeLeft());
      },
      stageOf: (state) => `${state.phase}:${state.step}`,
    });

    it("counts down from the server clock with the injected time", async () => {
      let clock = 10_000;
      const left: string[] = [];
      const { room } = setup(clockStrategy(left), "player", { now: () => clock });
      room.state.phase = "One";
      room.state.serverNow = 10_000;
      room.state.phaseEndsAt = 40_000;
      room.patch();
      await tick();
      clock += 5000;
      room.state.step = 1;
      room.patch();
      expect(left.at(-1)).toBe(" 25s left");
      clock += 60_000;
      room.state.step = 2;
      room.patch();
      expect(left.at(-1)).toBe(" 0s left");
    });

    it("says nothing without a deadline", async () => {
      const left: string[] = [];
      const { room } = setup(clockStrategy(left));
      room.state.phase = "One";
      room.patch();
      expect(left.at(-1)).toBe("");
    });

    it("reads the real clock when none is injected", async () => {
      const left: string[] = [];
      const { room } = setup(clockStrategy(left));
      room.state.phase = "One";
      room.state.serverNow = Date.now();
      room.state.phaseEndsAt = Date.now() + 30_000;
      room.patch();
      expect(left.at(-1)).toMatch(/^ (29|30)s left$/);
    });
  });

  describe("sending", () => {
    const sender = (outcome: { ok?: boolean }): TerminalStrategy<ToyState> => ({
      play: async (turn) => {
        outcome.ok = await turn.send("PING", { n: 1 }, "Pinged.");
        turn.notify("TYPING", { typing: true });
      },
    });

    it("prints the accepted line, or the refusal", async () => {
      const outcome: { ok?: boolean } = {};
      const { room, io, sent } = setup(sender(outcome));
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toContain("Pinged.");
      expect(outcome.ok).toBe(true);
      expect(sent()).toEqual([
        { n: 1, type: "PING" },
        { typing: true, type: "TYPING" },
      ]);
      room.reply = async () => REFUSED;
      room.state.phase = "Two";
      room.patch();
      await tick();
      expect(io.printed).toContain("Refused: Not yet");
      expect(outcome.ok).toBe(false);
    });

    it("tells an unexpected reply", async () => {
      const outcome: { ok?: boolean } = {};
      const { room, io } = setup(sender(outcome));
      room.reply = async () => "what";
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toContain("The server sent an unexpected reply.");
      expect(outcome.ok).toBe(false);
    });

    it("tells a failed request and swallows a failed notify", async () => {
      const outcome: { ok?: boolean } = {};
      const { room, io } = setup(sender(outcome));
      room.reply = async () => {
        throw new Error("socket closed");
      };
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(io.printed).toContain("Could not send that: Error: socket closed");
      expect(outcome.ok).toBe(false);
    });
  });

  describe("ending", () => {
    it("says so and stops when the room is gone", async () => {
      const { room, io, finished } = setup({ play: async () => {}, narrate: () => ["narration"] });
      await tick();
      room.close();
      await tick();
      expect(io.printed).toContain("You have left the room.");
      expect(finished.value).toBe(true);
      io.printed.length = 0;
      room.patch();
      expect(io.printed).toEqual([]);
    });

    it("resolves when stopped before the first state change", async () => {
      const room = new FakeRoom();
      const player = new TerminalPlayer(room, ME, new ScriptedIo(), idle);
      const finished = player.run();
      player.stop();
      await expect(finished).resolves.toBeUndefined();
    });

    it("quits from a stage", async () => {
      const { room, finished } = setup({ play: async (turn) => turn.quit() });
      room.state.phase = "One";
      room.patch();
      await tick();
      expect(finished.value).toBe(true);
    });
  });
});
