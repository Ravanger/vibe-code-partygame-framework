import { describe, expect, it } from "vitest";
import { TimerQueue } from "../src/timers.js";

describe("TimerQueue", () => {
  it("is empty: size 0, peek and shift undefined", () => {
    const queue = new TimerQueue();
    expect(queue.size).toBe(0);
    expect(queue.peek()).toBeUndefined();
    expect(queue.shift()).toBeUndefined();
  });

  it("shifts in (at, id) order and remove drops only the matching timers", () => {
    const queue = new TimerQueue();
    queue.push({ id: 1, at: 20, callback: () => {} });
    queue.push({ id: 2, at: 10, callback: () => {} });
    queue.push({ id: 3, at: 10, callback: () => {} });
    expect(queue.size).toBe(3);
    expect(queue.shift()?.id).toBe(2);
    queue.remove((t) => t.id === 3);
    expect(queue.size).toBe(1);
    expect(queue.peek()?.id).toBe(1);
  });
});
