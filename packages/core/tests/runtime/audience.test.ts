import { CLIENT_MESSAGES, ErrorCode } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  type ActionLog,
  actionFactory,
  actionLogMiddleware,
  defineGame,
  type GameDefinition,
  GameRuntime,
  getActionLog,
  type MiddlewareEvent,
  type PhaseState,
} from "../../src/index.js";
import { replayLog } from "../../src/replay/index.js";
import { FakeHost } from "../../src/testing/FakeHost.js";
import { TestTable } from "../../src/testing/TestTable.js";

interface S extends PhaseState {
  /** optionId -> vote count; audience votes need no per-member state. */
  votes: Record<string, number>;
  log: string[];
}

type Priv = Record<string, never>;
type Opt = Record<string, never>;

const action = actionFactory<S, Priv, Opt>();

const definition = defineGame<S, Priv, Opt>({
  name: "Audience",
  version: "1",
  minPlayers: 1,
  maxPlayers: 4,
  startPhase: "Play",
  createPrivateState: () => ({}),
  phases: {
    Play: {
      duration: 1000,
      onTimeout: (ctx) => ctx.transition("Score"),
      actions: {
        VOTE: action({
          from: "audience",
          payload: z.object({ option: z.enum(["a", "b"]) }),
          handler: (ctx) => {
            const first = ctx.audience.once(`vote:${ctx.payload.option}`);
            if (first) {
              ctx.state.votes[ctx.payload.option] = (ctx.state.votes[ctx.payload.option] ?? 0) + 1;
            }
            ctx.state.log.push(`vote:${ctx.payload.option}:${first ? "first" : "repeat"}`);
          },
        }),
        BOOMV: action({
          from: "audience",
          payload: z.object({}),
          handler: () => {
            throw new Error("boom");
          },
        }),
        SIGH: action({
          from: "audience",
          payload: z.object({}),
          handler: (ctx) => {
            ctx.reject(ErrorCode.NOT_ALLOWED, "no sighing");
          },
        }),
        GUESS: action({
          from: "player",
          payload: z.object({ n: z.number() }),
          handler: (ctx) => ctx.state.log.push(`guess:${ctx.playerId}:${ctx.payload.n}`),
        }),
      },
    },
    Score: {
      duration: 500,
      onTimeout: () => {},
      actions: {
        BACK: action({
          from: "host",
          payload: z.object({}),
          handler: (ctx) => ctx.transition("Play"),
        }),
      },
    },
  },
});

const newState = (): S => ({ phase: "", phaseEndsAt: 0, canStart: false, votes: {}, log: [] });

function setup() {
  const host = new FakeHost();
  host.seat("p1");
  host.seat("p2");
  const state = newState();
  const runtime = new GameRuntime({ definition, state, options: {}, host });
  return { host, state, runtime };
}

describe("audience actions", () => {
  it("accepts an audience action through dispatchAudience and counts the vote", () => {
    const { state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" })).toBeUndefined();
    expect(state.votes).toEqual({ a: 1 });
    expect(state.log).toEqual(["vote:a:first"]);
  });

  it("refuses an audience action from a seated player with NOT_ALLOWED", () => {
    const { host, state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatch("p1", { type: "VOTE", option: "a" });
    expect(error).toMatchObject({ code: ErrorCode.NOT_ALLOWED });
    expect(host.errorsTo("p1")).toEqual([
      { code: ErrorCode.NOT_ALLOWED, message: CLIENT_MESSAGES.NOT_ALLOWED },
    ]);
    expect(state.votes).toEqual({});
  });

  it("refuses a player action sent through dispatchAudience with UNAUTHORIZED", () => {
    const { host, state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatchAudience("aud-1", { type: "GUESS", n: 1 });
    expect(error).toMatchObject({ code: ErrorCode.UNAUTHORIZED });
    expect(host.errorsTo("aud-1")).toEqual([
      { code: ErrorCode.UNAUTHORIZED, message: CLIENT_MESSAGES.UNAUTHORIZED },
    ]);
    expect(state.log).toEqual([]);
  });

  it("validates the payload and refuses a bad one with INVALID_ACTION", () => {
    const { host, state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatchAudience("aud-1", { type: "VOTE", option: "c" });
    expect(error).toMatchObject({ code: ErrorCode.INVALID_ACTION, action: "VOTE" });
    expect(host.errorsTo("aud-1")).toEqual([
      {
        code: ErrorCode.INVALID_ACTION,
        message: CLIENT_MESSAGES.INVALID_ACTION,
        action: "VOTE",
      },
    ]);
    expect(state.votes).toEqual({});
  });

  it("refuses a malformed envelope with INVALID_ACTION without looking anything up", () => {
    const { host, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatchAudience("aud-1", "not an object");
    expect(error).toMatchObject({ code: ErrorCode.INVALID_ACTION });
    expect(host.errorsTo("aud-1")).toEqual([
      { code: ErrorCode.INVALID_ACTION, message: CLIENT_MESSAGES.INVALID_ACTION },
    ]);
  });

  it("runs the middleware chain with the audience key as senderId", () => {
    const events: MiddlewareEvent[] = [];
    const host = new FakeHost();
    host.seat("p1");
    const state = newState();
    const spec: GameDefinition<S, Priv, Opt> = {
      ...definition,
      middleware: [
        (ctx, next) => {
          events.push(ctx.event);
          next();
        },
      ],
    };
    const runtime = new GameRuntime({ definition: spec, state, options: {}, host });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" })).toBeUndefined();
    const actionEvents = events.filter((event) => event.kind === "action");
    expect(actionEvents).toHaveLength(2);
    expect(actionEvents[0]).toMatchObject({ actionType: "START_GAME", senderId: "p1" });
    expect(actionEvents[1]).toMatchObject({ actionType: "VOTE", senderId: "aud-1" });
  });

  it("lets a middleware reject an audience action, skipping the handler", () => {
    const host = new FakeHost();
    host.seat("p1");
    const state = newState();
    const spec: GameDefinition<S, Priv, Opt> = {
      ...definition,
      middleware: [
        (ctx, next) => {
          const event = ctx.event;
          if (event.kind === "action" && event.senderId === "aud-1") {
            ctx.reject(ErrorCode.NOT_ALLOWED, "no audience");
            return;
          }
          next();
        },
      ],
    };
    const runtime = new GameRuntime({ definition: spec, state, options: {}, host });
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    expect(error).toMatchObject({ code: ErrorCode.NOT_ALLOWED, message: "no audience" });
    expect(state.votes).toEqual({});
  });

  it("sends a handler ctx.reject to the audience key", () => {
    const { host, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    const error = runtime.dispatchAudience("aud-1", { type: "SIGH" });
    expect(error).toMatchObject({ code: ErrorCode.NOT_ALLOWED, message: "no sighing" });
    expect(host.errorsTo("aud-1")).toEqual([
      { code: ErrorCode.NOT_ALLOWED, message: "no sighing", action: "SIGH" },
    ]);
  });

  it("calls ctx.audience.once true once per key and scope", () => {
    const { state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    runtime.dispatchAudience("aud-2", { type: "VOTE", option: "a" });
    runtime.dispatchAudience("aud-1", { type: "VOTE", option: "b" });
    expect(state.votes).toEqual({ a: 2, b: 1 });
    expect(state.log).toEqual(["vote:a:first", "vote:a:repeat", "vote:a:first", "vote:b:first"]);
  });

  it("clears the once scopes when the phase changes", () => {
    const { host, state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    host.advance(1000);
    expect(runtime.phase).toBe("Score");
    runtime.dispatch("p1", { type: "BACK" });
    expect(runtime.phase).toBe("Play");
    runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    expect(state.votes).toEqual({ a: 2 });
    expect(state.log.at(-1)).toBe("vote:a:first");
  });

  it("runs the failure policy and rethrows when an audience handler throws", () => {
    const { state, runtime } = setup();
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(() => runtime.dispatchAudience("aud-1", { type: "BOOMV" })).toThrow("boom");
    expect(state.phase).toBe("Lobby");
    expect(state.notice).toBeTruthy();
  });

  it("refuses every audience action after stop", () => {
    const { runtime } = setup();
    runtime.stop();
    expect(runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" })).toMatchObject({
      code: ErrorCode.NOT_ALLOWED,
    });
  });

  it("records audience actions in the log with the audience key as senderId, roster untouched", () => {
    const table = new TestTable({
      definition: { ...definition, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: {},
      players: 2,
    });
    table.start();
    table.runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    const log = getActionLog(table.priv) as ActionLog;
    const entry = log.entries.find((e) => e.kind === "action" && e.actionType === "VOTE");
    expect(entry).toMatchObject({ senderId: "aud-1", phase: "Play" });
    expect(log.roster?.map((seat) => seat.id)).toEqual(["p1", "p2"]);
  });

  it("replays a logged audience session through dispatchAudience", () => {
    const live = new TestTable({
      definition: { ...definition, middleware: [actionLogMiddleware()] },
      state: newState(),
      options: {},
      players: 2,
    });
    live.start();
    live.runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    live.runtime.dispatchAudience("aud-1", { type: "VOTE", option: "a" });
    live.runtime.dispatchAudience("aud-1", { type: "VOTE", option: "b" });
    const log = getActionLog(live.priv) as ActionLog;
    const { states } = replayLog(definition, log, {
      state: newState(),
      options: {},
      players: 2,
    });
    expect(states[states.length - 1]).toMatchObject({
      phase: "Play",
      votes: { a: 1, b: 1 },
      log: ["vote:a:first", "vote:a:repeat", "vote:b:first"],
    });
  });
});
