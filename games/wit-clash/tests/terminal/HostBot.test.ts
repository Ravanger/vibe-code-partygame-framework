import { describe, expect, it } from "vitest";
import type { BotOutcome, BotRoom } from "../../bots/BotPlayer.js";
import { PHASE } from "../../src/phaseNames.js";
import { WitClashState } from "../../src/state.js";
import { HostBot, type HostBotOptions } from "../../terminal/HostBot.js";
import { ME, seat, tick } from "./support.js";

class FakeRoom implements BotRoom {
  readonly state = new WitClashState();
  readonly sent: object[] = [];
  readonly listeners: Array<() => void> = [];
  left = false;
  reply: () => Promise<unknown> = async () => ({ ok: true });

  onStateChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  request(_type: string, payload: object): Promise<unknown> {
    this.sent.push(payload);
    return this.reply();
  }

  async leave(): Promise<void> {
    this.left = true;
  }

  changed(): void {
    for (const listener of this.listeners) listener();
  }
}

const setup = (options: HostBotOptions = {}) => {
  const room = new FakeRoom();
  const outcomes: BotOutcome[] = [];
  const bot = new HostBot(room, ME, "Host Bot", {
    onOutcome: (outcome) => outcomes.push(outcome),
    ...options,
  });
  return { room, bot, outcomes };
};

describe("HostBot", () => {
  it("starts the game once the server says it can", async () => {
    const { room } = setup();
    room.changed();
    expect(room.sent).toEqual([]);
    room.state.canStart = true;
    room.changed();
    room.changed();
    await tick();
    expect(room.sent).toEqual([{ type: "START_GAME" }]);
  });

  it("waits for the expected number of named players", async () => {
    const { room } = setup({ expectedPlayers: 3 });
    room.state.canStart = true;
    seat(room.state, "p1", "A");
    seat(room.state, "p2", "B");
    seat(room.state, "p3", "");
    room.changed();
    expect(room.sent).toEqual([]);
    seat(room.state, "p3", "C");
    room.changed();
    expect(room.sent).toEqual([{ type: "START_GAME" }]);
  });

  it("tries again after the server refuses", async () => {
    const { room, outcomes } = setup();
    room.state.canStart = true;
    room.reply = async () => ({ ok: false, error: { code: "NOT_ENOUGH_PLAYERS", message: "no" } });
    room.changed();
    await tick();
    room.reply = async () => ({ ok: true });
    room.changed();
    await tick();
    expect(room.sent).toHaveLength(2);
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([false, true]);
  });

  it("reports a request that fails outright", async () => {
    const { room, outcomes } = setup();
    room.state.canStart = true;
    room.reply = async () => {
      throw new Error("closed");
    };
    room.changed();
    await tick();
    expect(outcomes).toEqual([
      { bot: "Host Bot", type: "START_GAME", ok: false, detail: "Error: closed" },
    ]);
  });

  it("does not start again once the game is running", async () => {
    const { room } = setup();
    room.state.canStart = true;
    room.changed();
    await tick();
    room.state.phase = PHASE.CategorySelection;
    room.changed();
    room.state.phase = "Lobby";
    room.changed();
    await tick();
    expect(room.sent).toHaveLength(2);
  });

  it("moves to the next round once per round, and stops after the final one", async () => {
    const { room } = setup();
    room.state.phase = PHASE.Results;
    room.state.roundNumber = 1;
    room.changed();
    room.changed();
    room.state.roundNumber = 2;
    room.changed();
    room.state.roundNumber = 3;
    room.state.isFinalRound = true;
    room.changed();
    await tick();
    expect(room.sent).toEqual([{ type: "NEXT_ROUND" }, { type: "NEXT_ROUND" }]);
  });

  it("waits the configured pause before moving to the next round", async () => {
    const queue: Array<{ run: () => void; ms: number }> = [];
    const { room } = setup({
      nextRoundDelayMs: 4000,
      schedule: (run, ms) => {
        queue.push({ run, ms });
        return () => undefined;
      },
    });
    room.state.phase = PHASE.Results;
    room.state.roundNumber = 1;
    room.changed();
    room.changed();
    await tick();
    expect(room.sent).toEqual([]);
    expect(queue.map((entry) => entry.ms)).toEqual([4000]);
    queue[0]?.run();
    await tick();
    expect(room.sent).toEqual([{ type: "NEXT_ROUND" }]);
  });

  it("uses a real timer for the pause, and leaving cancels it", async () => {
    const { room, bot } = setup({ nextRoundDelayMs: 20 });
    room.state.phase = PHASE.Results;
    room.state.roundNumber = 1;
    room.changed();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(room.sent).toHaveLength(1);

    room.state.roundNumber = 2;
    room.changed();
    await bot.leave();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(room.sent).toHaveLength(1);
  });

  it("leaves the room", async () => {
    const { room, bot } = setup();
    await bot.leave();
    expect(room.left).toBe(true);
  });

  it("works without an outcome listener", async () => {
    const room = new FakeRoom();
    new HostBot(room, ME, "Host Bot");
    room.state.canStart = true;
    room.changed();
    await tick();
    expect(room.sent).toHaveLength(1);
  });
});
