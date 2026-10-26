import { describe, expect, it } from "vitest";
import { defineGame, type GameDefinition, GameRuntime, type PhaseState } from "../../src/index.js";
import { FakeHost } from "../../src/testing/FakeHost.js";

type Spec = GameDefinition<PhaseState>;

function makeTable(phases: Spec["phases"], middleware?: Spec["middleware"], silent = false) {
  const host = new FakeHost();
  host.seat("p1");
  host.seat("p2");
  if (silent) delete host.log; // no logger supplied: the runtime falls back to its no-op default
  const state: PhaseState = { phase: "", phaseEndsAt: 0, canStart: false };
  const spec = defineGame<PhaseState>({
    name: "LogTest",
    version: "1",
    minPlayers: 2,
    maxPlayers: 4,
    startPhase: "Play",
    createPrivateState: () => ({}),
    phases,
    ...(middleware === undefined ? {} : { middleware }),
  });
  const runtime = new GameRuntime<PhaseState, Record<string, never>, Record<string, unknown>>({
    definition: spec,
    state,
    options: {},
    host,
  });
  return { host, runtime, state };
}

describe("ctx.log", () => {
  it("writes an info line to FakeHost.logs from a phase", () => {
    const { host, runtime } = makeTable({
      Play: { onEnter: (ctx) => ctx.log("custom.event", { n: 1 }) },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.logs).toEqual([{ level: "info", event: "custom.event", fields: { n: 1 } }]);
  });

  it("sets the level through ctx.log.warn and ctx.log.error, defaulting omitted fields to {}", () => {
    const { host, runtime } = makeTable({
      Play: {
        onEnter: (ctx) => {
          ctx.log("plain");
          ctx.log.warn("watch.out", { times: 2 });
          ctx.log.error("broken", { code: "X" });
        },
      },
    });
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.logs).toEqual([
      { level: "info", event: "plain", fields: {} },
      { level: "warn", event: "watch.out", fields: { times: 2 } },
      { level: "error", event: "broken", fields: { code: "X" } },
    ]);
  });

  it("lets middleware log through the same context, before the wrapped hook", () => {
    const { host, runtime } = makeTable({ Play: { onEnter: (ctx) => ctx.log("phase.enter") } }, [
      (ctx, next) => {
        if (ctx.event.kind === "enter" && ctx.phase === "Play") {
          ctx.log("mw.enter", { phase: ctx.phase });
        }
        next();
      },
    ]);
    runtime.dispatch("p1", { type: "START_GAME" });
    expect(host.logs).toEqual([
      { level: "info", event: "mw.enter", fields: { phase: "Play" } },
      { level: "info", event: "phase.enter", fields: {} },
    ]);
  });

  it("does not throw when the host supplies no logger (the default no-op)", () => {
    const { host, runtime, state } = makeTable(
      {
        Play: {
          onEnter: (ctx) => {
            ctx.log("quiet");
            ctx.log.warn("quiet.warn");
            ctx.log.error("quiet.error");
          },
        },
      },
      undefined,
      true,
    );
    expect(() => runtime.dispatch("p1", { type: "START_GAME" })).not.toThrow();
    expect(state.phase).toBe("Play");
    expect(host.logs).toEqual([]);
  });
});
