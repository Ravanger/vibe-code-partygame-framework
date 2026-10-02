import { type BotOptions, type BotOutcome, BotPlayer, type BotRoom } from "@partygame/bots";
import { describe, expect, it } from "vitest";
import {
  BOT_ANSWERS,
  type WitClashBotOptions,
  witClashBot,
  witClashKit,
} from "../../bots/witClashBot.js";
import { ACTION } from "../../src/actionNames.js";
import { PHASE } from "../../src/phaseNames.js";
import { ROOM_NAME } from "../../src/roomName.js";
import {
  Answer,
  CategoryOption,
  Matchup,
  PlayerPrivate,
  PromptAssignment,
  WitClashState,
} from "../../src/state.js";
import { tick } from "../terminal/support.js";

const ME = "me-0000001";

class FakeRoom implements BotRoom<WitClashState> {
  readonly state = new WitClashState();
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

const setup = (options: BotOptions = {}, strategy: WitClashBotOptions = {}) => {
  const room = new FakeRoom();
  const clock = new Clock();
  const lines: string[] = [];
  const bot = new BotPlayer(room, ME, "Bot 1", witClashBot(strategy), {
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

describe("witClashBot as a player", () => {
  it("does nothing in the lobby and on the results screen", () => {
    const { room, clock } = setup();
    enter(room, "Lobby", 0);
    enter(room, PHASE.Results);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("votes for a category once per round after a delay in the configured range", async () => {
    const { room, clock, lines } = setup({ reactMs: [100, 300] });
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
    await tick();
    expect(lines[0]).toBe('Bot 1 votes for A -> {"ok":true}');
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
      const { room, clock, lines } = setup({ thinkMs: [50, 90] });
      mineOf(room).prompts.push(prompt("m1"), prompt("m2", true), prompt("m3"));
      enter(room, phase);
      room.changed();
      expect(room.actions()).toEqual([{ typing: true, type: ACTION.SET_TYPING }]);
      expect(clock.queue.map((entry) => entry.ms)).toEqual([50, 50]);
      clock.flush();
      expect(room.actions().slice(1)).toEqual([
        { matchupId: "m1", answer: BOT_ANSWERS[0], type: ACTION.SUBMIT_ANSWER },
        { matchupId: "m3", answer: BOT_ANSWERS[0], type: ACTION.SUBMIT_ANSWER },
      ]);
      await tick();
      expect(lines).toEqual([
        'Bot 1 types -> {"ok":true}',
        'Bot 1 answers Prompt m1 -> {"ok":true}',
        'Bot 1 answers Prompt m3 -> {"ok":true}',
      ]);
    },
  );

  it("falls back to an empty answer when the pick lands past the list", () => {
    const { room, clock } = setup({ rng: () => 1 });
    mineOf(room).prompts.push(prompt("m1"));
    enter(room, PHASE.Prompting);
    clock.flush();
    expect(room.actions()[1]).toEqual({ matchupId: "m1", answer: "", type: ACTION.SUBMIT_ANSWER });
  });

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

  it("logs and reports rejections and failed requests", async () => {
    const outcomes: BotOutcome[] = [];
    const { room, clock, lines } = setup({ onOutcome: (outcome) => outcomes.push(outcome) });
    mineOf(room).prompts.push(prompt("m1"));
    room.reply = async () => ({ ok: false, error: { code: "NOT_ALLOWED", message: "no" } });
    enter(room, PHASE.Prompting);
    clock.flush();
    await tick();
    room.reply = async () => {
      throw new Error("closed");
    };
    enter(room, PHASE.TieBreakerPrompting);
    clock.flush();
    await tick();
    expect(outcomes.map(({ type, ok }) => [type, ok])).toEqual([
      [ACTION.SET_TYPING, false],
      [ACTION.SUBMIT_ANSWER, false],
      [ACTION.SET_TYPING, false],
      [ACTION.SUBMIT_ANSWER, false],
    ]);
    expect(outcomes[1]?.detail).toContain("NOT_ALLOWED");
    expect(lines.some((line) => line.includes("SUBMIT_ANSWER failed: Error: closed"))).toBe(true);
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

  it("never sends host actions as a player", () => {
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

describe("witClashBot as the host", () => {
  const hosting = (strategy: WitClashBotOptions = {}) => setup({ host: {} }, strategy);

  it("moves to the next round once per round, and stops after the final one", async () => {
    const { room, clock } = hosting();
    enter(room, PHASE.Results, 1);
    room.changed();
    clock.flush();
    enter(room, PHASE.Results, 2);
    clock.flush();
    room.state.roundNumber = 3;
    room.state.isFinalRound = true;
    room.changed();
    clock.flush();
    await tick();
    expect(room.actions()).toEqual([{ type: ACTION.NEXT_ROUND }, { type: ACTION.NEXT_ROUND }]);
  });

  it("waits the configured pause before moving to the next round", async () => {
    const { room, clock } = hosting({ nextRoundDelayMs: 4000 });
    enter(room, PHASE.Results, 1);
    room.changed();
    expect(room.sent).toEqual([]);
    expect(clock.queue.map((entry) => entry.ms)).toEqual([4000]);
    clock.flush();
    await tick();
    expect(room.actions()).toEqual([{ type: ACTION.NEXT_ROUND }]);
  });

  it("does not advance outside the results", () => {
    const { room, clock } = hosting();
    enter(room, PHASE.Prompting);
    clock.flush();
    expect(room.sent).toEqual([]);
  });

  it("plays too when it hosts", () => {
    const { room, clock } = hosting();
    room.state.categoryOptions.push(Object.assign(new CategoryOption(), { id: "a", name: "A" }));
    enter(room, PHASE.CategorySelection);
    clock.flush();
    expect(room.actions()).toEqual([{ categoryId: "a", type: ACTION.VOTE_CATEGORY }]);
  });
});

describe("witClashKit", () => {
  it("names the room and its state class", () => {
    const kit = witClashKit({ nextRoundDelayMs: 1 });
    expect(kit.roomName).toBe(ROOM_NAME);
    expect(new kit.stateClass()).toBeInstanceOf(WitClashState);
  });
});
