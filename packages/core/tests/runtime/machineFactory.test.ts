import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { buildPhaseMachine } from "../../src/runtime/machineFactory.js";

function makeHarness(phases: Record<string, { duration?: unknown }>, duration = () => 4242) {
  const calls: string[] = [];
  const timers = new Map<unknown, () => void>();
  let nextId = 0;
  const delays: number[] = [];
  const actor = createActor(
    buildPhaseMachine({
      phases,
      enter: (name) => calls.push(`enter:${name}`),
      timeout: () => calls.push("timeout"),
      duration,
      guard: (fn) => fn(),
    }),
    {
      clock: {
        setTimeout: (callback, ms) => {
          const id = ++nextId;
          if (ms !== undefined) delays.push(ms);
          timers.set(id, callback);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    },
  );
  actor.start();
  return {
    actor,
    calls,
    delays,
    pending: () => timers.size,
    fireAll() {
      for (const callback of [...timers.values()]) callback();
      timers.clear();
    },
  };
}

describe("buildPhaseMachine", () => {
  it("enters the initial phase on start and a GO target once", () => {
    const harness = makeHarness({ Lobby: {}, Alpha: {} });
    expect(harness.calls).toEqual(["enter:Lobby"]);
    harness.actor.send({ type: "GO", phase: "Alpha" });
    expect(harness.calls).toEqual(["enter:Lobby", "enter:Alpha"]);
  });

  it("re-enters when GO is sent to the current phase", () => {
    const harness = makeHarness({ Lobby: {}, Alpha: {} });
    harness.actor.send({ type: "GO", phase: "Alpha" });
    harness.actor.send({ type: "GO", phase: "Alpha" });
    expect(harness.calls).toEqual(["enter:Lobby", "enter:Alpha", "enter:Alpha"]);
  });

  it("schedules the after delay from duration() on timed phases only, and fires timeout()", () => {
    const harness = makeHarness({ Lobby: {}, Beta: { duration: 1 } });
    expect(harness.pending()).toBe(0);
    harness.actor.send({ type: "GO", phase: "Beta" });
    expect(harness.calls).toEqual(["enter:Lobby", "enter:Beta"]);
    expect(harness.delays).toEqual([4242]);
    harness.fireAll();
    expect(harness.calls).toEqual(["enter:Lobby", "enter:Beta", "timeout"]);
  });

  it("re-schedules the delay with the current duration() on re-entry", () => {
    let tick = 0;
    const harness = makeHarness({ Lobby: {}, Beta: { duration: 1 } }, () => ++tick * 1000);
    harness.actor.send({ type: "GO", phase: "Beta" });
    expect(harness.delays).toEqual([1000]);
    harness.fireAll();
    harness.actor.send({ type: "GO", phase: "Beta" });
    expect(harness.pending()).toBe(1);
    expect(harness.delays).toEqual([1000, 2000]);
  });

  it("ignores a GO for an unknown phase", () => {
    const harness = makeHarness({ Lobby: {}, Alpha: {} });
    harness.actor.send({ type: "GO", phase: "Nope" });
    expect(harness.calls).toEqual(["enter:Lobby"]);
    harness.actor.send({ type: "GO", phase: "Alpha" });
    expect(harness.calls).toEqual(["enter:Lobby", "enter:Alpha"]);
  });
});
