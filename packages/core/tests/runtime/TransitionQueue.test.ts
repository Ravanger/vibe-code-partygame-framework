import { describe, expect, it } from "vitest";
import { type Pending, TransitionQueue } from "../../src/runtime/TransitionQueue.js";

const phase = (name: string): Pending => ({ kind: "phase", phase: name });
const label = (next: Pending): string => (next.kind === "lobby" ? "lobby" : next.phase);

describe("TransitionQueue", () => {
  it("applies items in FIFO order and empties the queue", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    queue.push(phase("B"));
    queue.push({ kind: "lobby" });
    const applied: string[] = [];
    queue.drain(
      (next) => applied.push(label(next)),
      () => {},
    );
    expect(applied).toEqual(["A", "B", "lobby"]);
    queue.drain(
      (next) => applied.push(label(next)),
      () => {},
    );
    expect(applied).toEqual(["A", "B", "lobby"]);
  });

  it("processes transitions pushed during apply in the same drain", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    const applied: string[] = [];
    queue.drain(
      (next) => {
        applied.push(label(next));
        if (next.kind === "phase" && next.phase === "A") queue.push(phase("B"));
      },
      () => {},
    );
    expect(applied).toEqual(["A", "B"]);
  });

  it("throws on the 101st chained step with the phase-loop message", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    let applied = 0;
    expect(() =>
      queue.drain(
        (next) => {
          ++applied;
          queue.push(phase(label(next)));
        },
        () => {},
      ),
    ).toThrow("More than 100 chained transitions; phase loop?");
    expect(applied).toBe(100);
  });

  it("clear discards pending items", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    queue.push({ kind: "lobby" });
    queue.clear();
    const applied: string[] = [];
    queue.drain(
      (next) => applied.push(label(next)),
      () => {},
    );
    expect(applied).toEqual([]);
  });

  it("discards still-queued items when a step throws", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    queue.push({ kind: "lobby" });
    expect(() =>
      queue.drain(
        (next) => {
          if (next.kind === "phase") throw new Error("step boom");
        },
        () => {},
      ),
    ).toThrow("step boom");
    const applied: string[] = [];
    queue.drain(
      (next) => applied.push(label(next)),
      () => {},
    );
    expect(applied).toEqual([]);
  });

  it("isEmpty reflects the pending items", () => {
    const queue = new TransitionQueue();
    expect(queue.isEmpty()).toBe(true);
    queue.push(phase("A"));
    expect(queue.isEmpty()).toBe(false);
    queue.clear();
    expect(queue.isEmpty()).toBe(true);
  });

  it("runs afterEach after every apply", () => {
    const queue = new TransitionQueue();
    queue.push(phase("A"));
    queue.push({ kind: "lobby" });
    const order: string[] = [];
    queue.drain(
      (next) => order.push(`apply:${label(next)}`),
      () => order.push("after"),
    );
    expect(order).toEqual(["apply:A", "after", "apply:lobby", "after"]);
  });
});
