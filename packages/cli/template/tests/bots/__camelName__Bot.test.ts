import { type BotOptions, BotPlayer, type BotRoom } from "@partygame/bots";
import { describe, expect, it } from "vitest";
import {
  __camelName__Bot,
  __camelName__Kit,
  __PascalName__Bot,
} from "../../bots/__camelName__Bot.js";
import { ACTION } from "../../src/actionNames.js";
import { PHASE } from "../../src/phaseNames.js";
import { ROOM_NAME } from "../../src/roomName.js";
import { __PascalName__State } from "../../src/state.js";
import { tick } from "../terminal/support.js";

const ME = "me-0000001";

class FakeRoom implements BotRoom<__PascalName__State> {
  readonly state = new __PascalName__State();
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
  const bot = new BotPlayer(room, ME, "Bot 1", __camelName__Bot(), {
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

describe("__camelName__Bot", () => {
  it("does nothing outside Waving", () => {
    const { room, clock } = setup();
    enter(room, "Lobby");
    enter(room, PHASE.Results);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("waves once after a delay in the configured range", () => {
    const { room, clock } = setup({ reactMs: [100, 300] });
    enter(room, PHASE.Waving);
    expect(room.sent).toEqual([]);
    expect(clock.queue.map((entry) => entry.ms)).toEqual([100]);
    clock.flush();
    expect(room.sent).toEqual([{ type: "ACTION", payload: { type: ACTION.WAVE } }]);
  });

  it("keeps waving as its count grows, one pending wave at a time", () => {
    const { room, clock } = setup({ reactMs: [100, 300] });
    enter(room, PHASE.Waving);
    room.changed();
    expect(clock.queue).toHaveLength(1);
    clock.flush();
    room.state.waves.set(ME, 1);
    room.changed();
    expect(clock.queue).toHaveLength(1);
    clock.flush();
    expect(room.sent).toHaveLength(2);
  });

  it("logs the outcome of a wave", async () => {
    const { room, clock, lines } = setup();
    enter(room, PHASE.Waving);
    clock.flush();
    await tick();
    expect(lines[0]).toBe('Bot 1 waves -> {"ok":true}');
  });

  it("drops a pending wave when the phase changes", () => {
    const { room, clock } = setup({ reactMs: [100, 300] });
    enter(room, PHASE.Waving);
    expect(clock.queue).toHaveLength(1);
    enter(room, PHASE.Results);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("exposes a kit with the room name, state class and strategy", () => {
    const kit = __camelName__Kit();
    expect(kit.roomName).toBe(ROOM_NAME);
    expect(kit.stateClass).toBe(__PascalName__State);
    expect(kit.strategy).toBeInstanceOf(__PascalName__Bot);
  });
});
