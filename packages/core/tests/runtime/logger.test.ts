import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type GameDefinition,
  GameRuntime,
  noopLogger,
  type PhaseState,
} from "../../src/index.js";
import { ReplayHost } from "../../src/replay/ReplayHost.js";
import { FakeHost } from "../../src/testing/FakeHost.js";

type S = PhaseState;
const action = actionFactory<S, Record<string, never>, Record<string, unknown>>();

/** A game whose single phase action logs one line per level. */
function loggingDefinition(): GameDefinition<S> {
  return defineGame<S, Record<string, never>, Record<string, unknown>>({
    name: "G",
    version: "1",
    minPlayers: 2,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({}),
    phases: {
      Play: {
        actions: {
          LOG_LINE: action({
            from: "player",
            payload: z.object({}),
            handler: (ctx) => {
              ctx.log("custom.event", { n: 1 });
              ctx.log.warn("warned");
              ctx.log.error("failed", { code: "X" });
            },
          }),
        },
      },
    },
  });
}

function started(): {
  host: FakeHost;
  runtime: GameRuntime<S, Record<string, never>, Record<string, unknown>>;
} {
  const host = new FakeHost();
  host.seat("p1");
  host.seat("p2");
  const state: S = { phase: "Lobby", phaseEndsAt: 0, canStart: false };
  const runtime = new GameRuntime<S, Record<string, never>, Record<string, unknown>>({
    definition: loggingDefinition(),
    state,
    host,
    options: {},
  });
  runtime.dispatch("p1", { type: "START_GAME" });
  return { host, runtime };
}

describe("ctx.log", () => {
  it("reaches FakeHost.logs with the level and fields", () => {
    const { host, runtime } = started();
    runtime.dispatch("p2", { type: "LOG_LINE" });
    expect(host.logs).toEqual([
      { level: "info", event: "custom.event", fields: { n: 1 } },
      { level: "warn", event: "warned" },
      { level: "error", event: "failed", fields: { code: "X" } },
    ]);
  });

  it("omits the fields key when no fields are passed", () => {
    const { host, runtime } = started();
    runtime.dispatch("p2", { type: "LOG_LINE" });
    expect(host.logs[1]).toStrictEqual({ level: "warn", event: "warned" });
  });

  it("lets middleware log through the same context, before the wrapped hook", () => {
    const host = new FakeHost();
    host.seat("p1");
    host.seat("p2");
    const state: S = { phase: "Lobby", phaseEndsAt: 0, canStart: false };
    const definition = defineGame<S, Record<string, never>, Record<string, unknown>>({
      name: "G",
      version: "1",
      minPlayers: 2,
      maxPlayers: 4,
      startPhase: "Play",
      createPrivateState: () => ({}),
      phases: { Play: { onEnter: (ctx) => ctx.log("phase.enter") } },
      middleware: [
        (ctx, next) => {
          if (ctx.event.kind === "enter" && ctx.phase === "Play")
            ctx.log("mw.enter", { phase: ctx.phase });
          next();
        },
      ],
    });
    const runtime = new GameRuntime<S, Record<string, never>, Record<string, unknown>>({
      definition,
      state,
      host,
      options: {},
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.logs).toEqual([
      { level: "info", event: "mw.enter", fields: { phase: "Play" } },
      { level: "info", event: "phase.enter" },
    ]);
  });

  it("does not throw when the host provides no logger", () => {
    const host = new ReplayHost();
    host.seat("p1");
    host.seat("p2");
    const state: S = { phase: "Lobby", phaseEndsAt: 0, canStart: false };
    const runtime = new GameRuntime<S, Record<string, never>, Record<string, unknown>>({
      definition: loggingDefinition(),
      state,
      host,
      options: {},
    });
    expect(() => {
      runtime.dispatch("p1", { type: "START_GAME" });
      runtime.dispatch("p2", { type: "LOG_LINE" });
    }).not.toThrow();
  });
});

describe("noopLogger", () => {
  it("swallows every level and field shape", () => {
    expect(() => {
      noopLogger("direct");
      noopLogger.info("a");
      noopLogger.warn("b", { n: 1 });
      noopLogger.error("c", { ok: true, s: "x" });
    }).not.toThrow();
  });
});
