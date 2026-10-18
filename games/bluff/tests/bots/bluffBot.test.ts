import { type BotOptions, BotPlayer, type BotRoom } from "@partygame/bots";
import { describe, expect, it } from "vitest";
import { BluffBot, bluffBot, bluffKit } from "../../bots/bluffBot.js";
import { ACTION } from "../../src/actionNames.js";
import { META } from "../../src/meta.js";
import { PHASE } from "../../src/phaseNames.js";
import { BluffOption, BluffState, PlayerPrivate } from "../../src/state.js";

const ME = "me-0000001";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

class FakeRoom implements BotRoom<BluffState> {
  readonly state = new BluffState();
  readonly sent: Array<{ type: string; payload: object }> = [];
  readonly listeners: Array<() => void> = [];
  readonly leavers: Array<() => void> = [];
  left = false;
  reply: () => Promise<unknown> = async () => ({ ok: true });

  onStateChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  onLeave(callback: () => void): void {
    this.leavers.push(callback);
  }

  request(type: string, payload: object): Promise<unknown> {
    this.sent.push({ type, payload });
    return this.reply();
  }

  async leave(): Promise<void> {
    this.left = true;
  }

  changed(): void {
    for (const listener of this.listeners) listener();
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

const setup = (options: BotOptions = {}) => {
  const room = new FakeRoom();
  const clock = new Clock();
  const lines: string[] = [];
  const bot = new BotPlayer(room, ME, "Bot 1", bluffBot(), {
    rng: () => 0,
    schedule: clock.schedule,
    log: (line) => lines.push(line),
    ...options,
  });
  return { room, clock, lines, bot };
};

const enter = (room: FakeRoom, phase: string): void => {
  room.state.phase = phase;
  room.changed();
};

const addChoice = (room: FakeRoom, id: string, text: string): void => {
  room.state.choices.push(Object.assign(new BluffOption(), { id, text }));
};

describe("bluffBot", () => {
  it("does nothing outside Writing and Voting", () => {
    const { room, clock } = setup();
    enter(room, "Lobby");
    enter(room, PHASE.Results);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("writes a fake once after a think delay", () => {
    const { room, clock } = setup({ thinkMs: [100, 300] });
    enter(room, PHASE.Writing);
    expect(room.sent).toEqual([]);
    expect(clock.queue.map((entry) => entry.ms)).toEqual([100]);

    clock.flush();
    expect(room.sent).toEqual([
      { type: "ACTION", payload: { text: "The moon", type: ACTION.SUBMIT_FAKE } },
    ]);

    room.changed();
    expect(clock.queue).toHaveLength(0);
  });

  it("falls back to a plain fake when the pick lands past the list", () => {
    const { room, clock } = setup({ thinkMs: [100, 300], rng: () => 1 });
    enter(room, PHASE.Writing);
    clock.flush();
    expect(room.sent).toEqual([
      { type: "ACTION", payload: { text: "No idea", type: ACTION.SUBMIT_FAKE } },
    ]);
  });

  it("does not write when its fake is already in", () => {
    const { room, clock } = setup();
    room.state.progress.set(ME, true);
    enter(room, PHASE.Writing);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("votes for a choice that is not its own", () => {
    const { room, clock } = setup({ reactMs: [50, 200] });
    addChoice(room, "o1", "Canberra");
    addChoice(room, "o2", "Sydney");
    addChoice(room, "o3", "Perth");
    room.state.mine.set(ME, Object.assign(new PlayerPrivate(), { myOptionId: "o1" }));
    enter(room, PHASE.Voting);

    clock.flush();
    expect(room.sent).toEqual([
      { type: "ACTION", payload: { optionId: "o2", type: ACTION.CAST_VOTE } },
    ]);
  });

  it("still votes when its private view is missing", () => {
    const { room, clock } = setup({ reactMs: [50, 200] });
    addChoice(room, "o1", "Canberra");
    enter(room, PHASE.Voting);
    clock.flush();
    const [vote] = room.sent;
    expect(vote?.payload).toMatchObject({ optionId: "o1" });
  });

  it("skips the vote when the pick lands past the list", () => {
    const { room, clock } = setup({ reactMs: [50, 200], rng: () => 1 });
    addChoice(room, "o1", "Canberra");
    enter(room, PHASE.Voting);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("logs the outcome of a fake", async () => {
    const { room, clock, lines } = setup({ thinkMs: [100, 300] });
    enter(room, PHASE.Writing);
    clock.flush();
    await tick();
    expect(lines[0]).toBe('Bot 1 fakes -> {"ok":true}');
  });

  it("drops pending steps when the phase changes", () => {
    const { room, clock } = setup({ thinkMs: [100, 300] });
    enter(room, PHASE.Writing);
    expect(clock.queue).toHaveLength(1);
    enter(room, PHASE.Voting);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("exposes a kit with the room name, state class and strategy", () => {
    const kit = bluffKit();
    expect(kit.roomName).toBe(META.roomName);
    expect(kit.stateClass).toBe(BluffState);
    expect(kit.strategy).toBeInstanceOf(BluffBot);
  });
});
