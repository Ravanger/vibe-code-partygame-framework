import { type SchemaType, t } from "@colyseus/schema";
import { LOBBY_PHASE, START_GAME } from "@partygame/shared";
import { BaseGameState, PlayerSchema } from "@partygame/shared/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotPlayer } from "../src/BotPlayer.js";
import type { BotOptions, BotOutcome, BotRoom, BotStrategy, BotTurn } from "../src/types.js";

const ToyState = BaseGameState.extend({ step: t.number().default(0) }, "ToyState");
type ToyState = SchemaType<typeof ToyState>;

const ME = "me-0000001";

class FakeRoom implements BotRoom<ToyState> {
  readonly state = new ToyState();
  readonly sent: object[] = [];
  readonly listeners: Array<() => void> = [];
  left = false;
  readonly leavers: Array<() => void> = [];
  reply: () => Promise<unknown> = async () => ({ ok: true });

  onStateChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  onLeave(callback: () => void): void {
    this.leavers.push(callback);
  }

  close(): void {
    for (const leaver of this.leavers) leaver();
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

  seat(id: string, name: string): void {
    this.state.players.set(id, Object.assign(new PlayerSchema(), { id, name }));
  }
}

class Clock {
  readonly queue: Array<{ run: () => void; ms: number; live: boolean }> = [];

  schedule = (run: () => void, ms: number): (() => void) => {
    const entry = { run, ms, live: true };
    this.queue.push(entry);
    return () => {
      entry.live = false;
    };
  };

  flush(): void {
    for (const entry of this.queue.splice(0)) if (entry.live) entry.run();
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(strategy: BotStrategy<ToyState>, options: BotOptions = {}) {
  const room = new FakeRoom();
  room.state.phase = "Play";
  const clock = new Clock();
  const outcomes: BotOutcome[] = [];
  const lines: string[] = [];
  const bot = new BotPlayer(room, ME, "Bot 1", strategy, {
    rng: () => 0,
    schedule: clock.schedule,
    onOutcome: (outcome) => outcomes.push(outcome),
    log: (line) => lines.push(line),
    ...options,
  });
  return { room, clock, outcomes, lines, bot };
}

const tapOnce: BotStrategy<ToyState> = {
  play: (turn) =>
    turn.once(`tap:${turn.state.step}`, () =>
      turn.later("react", () => turn.act("TAP", {}, "taps")),
    ),
};

describe("BotPlayer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("acts once per key after the paced delay and reports the outcome", async () => {
    const { room, clock, outcomes, lines } = setup(tapOnce, { reactMs: [100, 300] });
    room.changed();
    expect(clock.queue).toHaveLength(1);
    expect(clock.queue[0]?.ms).toBe(100);
    clock.flush();
    await settle();
    expect(room.sent).toEqual([{ type: "TAP" }]);
    expect(outcomes).toEqual([{ bot: "Bot 1", type: "TAP", ok: true, detail: '{"ok":true}' }]);
    expect(lines).toEqual(['Bot 1 taps -> {"ok":true}']);
  });

  it("forgets keys and cancels pending moves when the phase changes", () => {
    const { room, clock } = setup(tapOnce);
    room.state.phase = "Other";
    room.changed();
    room.state.phase = "Play";
    room.changed();
    clock.flush();
    expect(room.sent).toHaveLength(1);
  });

  it("uses think for slow moves and an explicit range when given", () => {
    const seen: number[] = [];
    const { clock } = setup(
      {
        play: (turn) => {
          turn.once("a", () => turn.later("think", () => undefined));
          turn.once("b", () => turn.later([7, 7], () => undefined));
        },
      },
      { thinkMs: [40, 50] },
    );
    for (const entry of clock.queue) seen.push(entry.ms);
    expect(seen).toEqual([40, 7]);
  });

  it("picks with the rng and returns undefined from an empty list", () => {
    const picked: Array<string | undefined> = [];
    setup(
      { play: (turn) => picked.push(turn.pick(["x", "y"]), turn.pick([])) },
      { rng: () => 0.99 },
    );
    expect(picked.slice(0, 2)).toEqual(["y", undefined]);
  });

  it("reports a rejection and a failed request as not ok", async () => {
    const { room, clock, outcomes, lines } = setup(tapOnce);
    room.reply = async () => ({ ok: false, error: { code: "NOT_ALLOWED", message: "no" } });
    clock.flush();
    await settle();
    room.reply = async () => {
      throw new Error("socket closed");
    };
    room.state.step = 1;
    room.changed();
    clock.flush();
    await settle();
    expect(outcomes.map((o) => o.ok)).toEqual([false, false]);
    expect(outcomes[1]?.detail).toContain("socket closed");
    expect(lines[1]).toContain("TAP failed");
  });

  it("is silent without a log and an outcome sink", async () => {
    const room = new FakeRoom();
    room.state.phase = "Play";
    const clock = new Clock();
    new BotPlayer(room, ME, "Bot 1", tapOnce, { schedule: clock.schedule });
    clock.flush();
    await settle();
    expect(room.sent).toHaveLength(1);
  });

  it("cancels pending moves and leaves the room", async () => {
    const { room, clock, bot } = setup(tapOnce);
    await bot.leave();
    clock.flush();
    expect(room.sent).toEqual([]);
    expect(room.left).toBe(true);
  });

  it("does not leave a room that has already closed", async () => {
    const { room, clock, bot } = setup(tapOnce);
    room.close();
    await bot.leave();
    clock.flush();
    expect(room.sent).toEqual([]);
    expect(room.left).toBe(false);
  });

  it("falls back to the default think and react ranges", () => {
    const { clock } = setup({
      play: (turn) => {
        turn.once("a", () => turn.later("think", () => undefined));
        turn.once("b", () => turn.later("react", () => undefined));
      },
    });
    expect(clock.queue.map((entry) => entry.ms)).toEqual([2000, 500]);
  });

  it("cancels a real timer when the bot leaves", async () => {
    vi.useFakeTimers();
    const room = new FakeRoom();
    room.state.phase = "Play";
    const bot = new BotPlayer(room, ME, "Bot 1", tapOnce, { reactMs: [0, 0] });
    await bot.leave();
    vi.advanceTimersByTime(10);
    expect(room.sent).toEqual([]);
  });

  it("schedules with real timers by default", () => {
    vi.useFakeTimers();
    const room = new FakeRoom();
    room.state.phase = "Play";
    new BotPlayer(room, ME, "Bot 1", tapOnce, { reactMs: [0, 0] });
    vi.advanceTimersByTime(10);
    expect(room.sent).toEqual([{ type: "TAP" }]);
  });

  it("ignores state changes after leaving", async () => {
    const { room, clock, bot } = setup(tapOnce);
    await bot.leave();
    clock.flush();
    room.state.step = 1;
    room.changed();
    expect(clock.queue).toEqual([]);
    expect(room.sent).toEqual([]);
  });

  it("does not start the game after a host leaves", async () => {
    const { room, bot } = setup({ play: () => undefined }, { host: {} });
    room.state.phase = LOBBY_PHASE;
    await bot.leave();
    room.state.canStart = true;
    room.changed();
    await settle();
    expect(room.sent).toEqual([]);
  });

  it("reads fresh state when a delayed move runs", () => {
    const seen: number[] = [];
    const { room, clock } = setup({
      play: (turn) => turn.once("a", () => turn.later("react", () => seen.push(turn.state.step))),
    });
    room.state.step = 5;
    clock.flush();
    expect(seen).toEqual([5]);
  });

  describe("hosting", () => {
    function lobby(
      options: BotOptions,
      strategy: BotStrategy<ToyState> = { play: () => undefined },
    ) {
      const made = setup(strategy, options);
      made.room.state.phase = LOBBY_PHASE;
      made.room.seat(ME, "Host");
      return made;
    }

    it("starts once the room can start and enough seats are named", async () => {
      const { room } = lobby({ host: { expectedPlayers: 2 } });
      room.state.canStart = true;
      room.changed();
      expect(room.sent).toEqual([]);
      room.seat("p2-0000001", "Ann");
      room.changed();
      room.changed();
      await settle();
      expect(room.sent).toEqual([{ type: START_GAME }]);
    });

    it("tries again after a refusal", async () => {
      const { room } = lobby({ host: {} });
      room.reply = async () => ({ ok: false, error: { code: "NOT_ENOUGH_PLAYERS", message: "x" } });
      room.state.canStart = true;
      room.changed();
      await settle();
      room.changed();
      await settle();
      expect(room.sent).toHaveLength(2);
    });

    it("runs the strategy's host hook only for the host", () => {
      const hosted: string[] = [];
      const strategy: BotStrategy<ToyState> = {
        play: () => undefined,
        host: (turn: BotTurn<ToyState>) => hosted.push(turn.state.phase),
      };
      setup(strategy);
      expect(hosted).toEqual([]);
      setup(strategy, { host: {} });
      expect(hosted).toEqual(["Play"]);
    });

    it("starts again when the lobby comes back", async () => {
      const { room } = lobby({ host: {} });
      room.state.canStart = true;
      room.changed();
      await settle();
      room.state.phase = "Play";
      room.changed();
      room.state.phase = LOBBY_PHASE;
      room.changed();
      await settle();
      expect(room.sent).toEqual([{ type: START_GAME }, { type: START_GAME }]);
    });

    it("starts, then hosts, then plays within one pass", () => {
      const order: string[] = [];
      const { room } = lobby(
        { host: {} },
        { play: () => order.push("play"), host: () => order.push("host") },
      );
      order.length = 0;
      room.request = async () => {
        order.push("start");
        return { ok: true };
      };
      room.state.canStart = true;
      room.changed();
      expect(order).toEqual(["start", "host", "play"]);
    });

    it("runs the host hook on every state change", () => {
      let hosted = 0;
      const { room } = lobby({ host: {} }, { play: () => undefined, host: () => ++hosted });
      room.changed();
      room.changed();
      expect(hosted).toBe(3);
    });

    it("never starts the game when it is not the host", async () => {
      const { room } = lobby({});
      room.state.canStart = true;
      room.changed();
      await settle();
      expect(room.sent).toEqual([]);
    });
  });
});
