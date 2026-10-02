import { describe, expect, it } from "vitest";
import { type BotOptions, type BotOutcome, BotPlayer, type BotRoom } from "../../bots/BotPlayer.js";
import { ACTION } from "../../src/actionNames.js";
import { PHASE } from "../../src/phaseNames.js";
import {
  Answer,
  CategoryOption,
  Matchup,
  PlayerPrivate,
  PromptAssignment,
  WitClashState,
} from "../../src/state.js";

const ME = "me-0000001";

class FakeRoom implements BotRoom {
  readonly state = new WitClashState();
  readonly sent: Array<{ type: string; payload: object }> = [];
  readonly listeners: Array<() => void> = [];
  left = false;
  reply: () => Promise<unknown> = async () => ({ ok: true });

  onStateChange(callback: () => void): void {
    this.listeners.push(callback);
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

  actions(): object[] {
    return this.sent.map((sent) => sent.payload);
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
  const bot = new BotPlayer(room, ME, "Bot 1", {
    rng: () => 0,
    schedule: clock.schedule,
    log: (line) => lines.push(line),
    ...options,
  });
  return { room, clock, lines, bot };
};

const mineOf = (room: FakeRoom, fields: Partial<PlayerPrivate> = {}): PlayerPrivate => {
  const mine = Object.assign(new PlayerPrivate(), fields);
  room.state.mine.set(ME, mine);
  return mine;
};

const prompt = (matchupId: string, submitted = false): PromptAssignment =>
  Object.assign(new PromptAssignment(), {
    matchupId,
    promptText: `Prompt ${matchupId}`,
    submitted,
  });

const matchup = (id: string, ...answerIds: string[]): Matchup => {
  const created = Object.assign(new Matchup(), { id });
  for (const answerId of answerIds) {
    created.answers.push(Object.assign(new Answer(), { id: answerId, text: `text ${answerId}` }));
  }
  return created;
};

const enter = (room: FakeRoom, phase: string, roundNumber = 1): void => {
  room.state.phase = phase;
  room.state.roundNumber = roundNumber;
  room.changed();
};

describe("BotPlayer", () => {
  it("does nothing in the lobby and on the results screen", () => {
    const { room, clock } = setup();
    enter(room, "Lobby", 0);
    enter(room, PHASE.Results);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("votes for an option once per round after a delay in the configured range", () => {
    const { room, clock } = setup({ voteDelayMs: [100, 300] });
    room.state.categoryOptions.push(
      Object.assign(new CategoryOption(), { id: "a", name: "A" }),
      Object.assign(new CategoryOption(), { id: "b", name: "B" }),
    );
    enter(room, PHASE.CategorySelection);
    room.changed();
    expect(room.sent).toEqual([]);
    expect(clock.queue.map((entry) => entry.ms)).toEqual([100]);
    clock.flush();
    expect(room.sent).toEqual([
      { type: "ACTION", payload: { categoryId: "a", type: ACTION.VOTE_CATEGORY } },
    ]);
    enter(room, PHASE.CategorySelection, 2);
    clock.flush();
    expect(room.sent).toHaveLength(2);
  });

  it("plays again after the game returns to the lobby", () => {
    const { room, clock } = setup();
    room.state.categoryOptions.push(Object.assign(new CategoryOption(), { id: "a", name: "A" }));
    enter(room, PHASE.CategorySelection);
    clock.flush();
    enter(room, "Lobby", 0);
    enter(room, PHASE.CategorySelection);
    clock.flush();
    expect(room.sent).toHaveLength(2);
  });

  it("drops actions still pending when the phase moves on", () => {
    const { room, clock } = setup();
    room.state.categoryOptions.push(Object.assign(new CategoryOption(), { id: "a", name: "A" }));
    enter(room, PHASE.CategorySelection);
    enter(room, PHASE.Prompting);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("waits for category options to appear", () => {
    const { room, clock } = setup();
    enter(room, PHASE.CategorySelection);
    expect(clock.queue).toEqual([]);
  });

  it.each([PHASE.Prompting, PHASE.TieBreakerPrompting])(
    "starts typing and answers every open prompt in %s",
    async (phase) => {
      const { room, clock, lines } = setup();
      const mine = mineOf(room);
      mine.prompts.push(prompt("m1"), prompt("m2", true), prompt("m3"));
      enter(room, phase);
      room.changed();
      expect(room.actions()).toEqual([{ typing: true, type: ACTION.SET_TYPING }]);
      clock.flush();
      expect(room.actions().slice(1)).toEqual([
        { matchupId: "m1", answer: expect.any(String), type: ACTION.SUBMIT_ANSWER },
        { matchupId: "m3", answer: expect.any(String), type: ACTION.SUBMIT_ANSWER },
      ]);
      await Promise.resolve();
      await Promise.resolve();
      expect(lines).toHaveLength(3);
    },
  );

  it("stays quiet when it has no prompts or every prompt is submitted", () => {
    const { room, clock } = setup();
    enter(room, PHASE.Prompting);
    mineOf(room).prompts.push(prompt("m1", true));
    room.changed();
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("casts a vote on the active matchup only while it may vote", () => {
    const { room, clock } = setup();
    room.state.matchups.push(matchup("m1", "a1", "a2"));
    const mine = mineOf(room);
    enter(room, PHASE.MatchupVoting);
    room.state.activeMatchupIndex = 0;
    room.changed();
    clock.flush();
    expect(room.sent).toEqual([]);
    mine.canVote = true;
    room.changed();
    room.changed();
    clock.flush();
    expect(room.actions()).toEqual([{ answerId: "a1", type: ACTION.CAST_VOTE }]);
  });

  it("does not vote without an active matchup or answers", () => {
    const { room, clock } = setup();
    room.state.matchups.push(matchup("m1"));
    enter(room, PHASE.MatchupVoting);
    room.state.activeMatchupIndex = -1;
    room.changed();
    room.state.activeMatchupIndex = 0;
    mineOf(room, { canVote: true });
    room.changed();
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("votes in the latest tie-breaker", () => {
    const { room, clock } = setup({ rng: () => 0.99 });
    enter(room, PHASE.TieBreakerVoting);
    mineOf(room, { canVote: true });
    room.changed();
    room.state.tieBreakers.push(matchup("t1", "x1", "x2"), matchup("t2", "y1", "y2"));
    room.changed();
    clock.flush();
    expect(room.actions()).toEqual([{ answerId: "y2", type: ACTION.CAST_VOTE }]);
  });

  it("logs rejections and failed requests", async () => {
    const { room, clock, lines } = setup();
    mineOf(room).prompts.push(prompt("m1"));
    enter(room, PHASE.Prompting);
    room.reply = async () => {
      throw new Error("closed");
    };
    clock.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lines.some((line) => line.includes("SUBMIT_ANSWER failed: Error: closed"))).toBe(true);
  });

  it("reports the outcome of every action, rejections and failures included", async () => {
    const outcomes: BotOutcome[] = [];
    const { room, clock } = setup({ onOutcome: (outcome) => outcomes.push(outcome) });
    mineOf(room).prompts.push(prompt("m1"));
    const rejected = { ok: false, error: { code: "NOT_ALLOWED", message: "no" } };
    room.reply = async () => rejected;
    enter(room, PHASE.Prompting);
    clock.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    room.reply = async () => {
      throw new Error("closed");
    };
    enter(room, PHASE.TieBreakerPrompting);
    clock.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(outcomes.map(({ type, ok }) => [type, ok])).toEqual([
      [ACTION.SET_TYPING, false],
      [ACTION.SUBMIT_ANSWER, false],
      [ACTION.SET_TYPING, false],
      [ACTION.SUBMIT_ANSWER, false],
    ]);
    expect(outcomes[1]?.detail).toContain("NOT_ALLOWED");
    expect(outcomes[3]?.detail).toBe("Error: closed");
  });

  it("counts an accepted action as ok", async () => {
    const outcomes: BotOutcome[] = [];
    const { room, clock } = setup({ onOutcome: (outcome) => outcomes.push(outcome) });
    mineOf(room).prompts.push(prompt("m1"));
    enter(room, PHASE.Prompting);
    clock.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(outcomes[0]).toEqual({
      bot: "Bot 1",
      type: ACTION.SET_TYPING,
      ok: true,
      detail: '{"ok":true}',
    });
  });

  it("uses real timers by default and cancels them on leave", async () => {
    const room = new FakeRoom();
    const bot = new BotPlayer(room, ME, "Bot 1");
    room.state.categoryOptions.push(Object.assign(new CategoryOption(), { id: "a" }));
    enter(room, PHASE.CategorySelection);
    await bot.leave();
    expect(room.sent).toEqual([]);
  });

  it("logs nowhere unless asked to", async () => {
    const room = new FakeRoom();
    const bot = new BotPlayer(room, ME, "Bot 1", { voteDelayMs: [0, 0] });
    room.state.categoryOptions.push(Object.assign(new CategoryOption(), { id: "a" }));
    enter(room, PHASE.CategorySelection);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(room.sent).toHaveLength(1);
    await bot.leave();
  });

  it("leave() cancels pending actions and leaves the room", async () => {
    const { room, clock, bot } = setup();
    mineOf(room).prompts.push(prompt("m1"));
    enter(room, PHASE.Prompting);
    await bot.leave();
    clock.flush();
    expect(room.actions()).toEqual([{ typing: true, type: ACTION.SET_TYPING }]);
    expect(room.left).toBe(true);
  });

  it("never sends host-only actions", () => {
    const { room, clock } = setup();
    mineOf(room, { canVote: true }).prompts.push(prompt("m1"));
    room.state.matchups.push(matchup("m1", "a1", "a2"));
    room.state.activeMatchupIndex = 0;
    for (const phase of Object.values(PHASE)) {
      enter(room, phase);
      clock.flush();
    }
    const types = room.actions().map((payload) => Reflect.get(payload, "type"));
    expect(types).not.toContain(ACTION.NEXT_ROUND);
    expect(types).not.toContain(ACTION.PLAY_AGAIN);
    expect(types).not.toContain(ACTION.END_GAME);
    expect(types).not.toContain("START_GAME");
  });
});
