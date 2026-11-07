import { required } from "./utils.js";

/** The most timers one `advance` call may fire, on any host. */
export const MAX_TIMER_FIRES_PER_ADVANCE = 10_000;

/** The most timers one `replayLog` run may fire in total, across all its advances. */
export const MAX_TIMER_FIRES_PER_REPLAY = 1_000_000;

/** A pending timer: when it fires and what it does. */
export interface QueuedTimer {
  /** Creation order; breaks ties so same-time timers fire in creation order. */
  id: number;
  /** Host time at which the timer fires. */
  at: number;
  callback: () => void;
}

/** Thrown when an `advance` call would fire more timers than its budget allows. */
export class TimerLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimerLimitError";
  }
}

/** True when `a` must fire before `b`: earlier time, then creation order. */
function firesBefore(a: QueuedTimer, b: QueuedTimer): boolean {
  return a.at < b.at || (a.at === b.at && a.id < b.id);
}

/**
 * A min-heap of pending timers ordered by `(at, id)`: push and shift cost O(log n), so firing n
 * due timers costs O(n log n) in total instead of the per-fire filter-and-sort the hosts used to
 * pay (which made a hostile log's huge time gaps quadratic work).
 */
export class TimerQueue {
  private items: QueuedTimer[] = [];

  /** The number of pending timers. */
  get size(): number {
    return this.items.length;
  }

  /** The earliest pending timer, or `undefined` when none is pending. */
  peek(): QueuedTimer | undefined {
    return this.items[0];
  }

  push(timer: QueuedTimer): void {
    this.items.push(timer);
    this.siftUp(this.items.length - 1);
  }

  /** Removes and returns the earliest timer; `undefined` when none is pending. */
  shift(): QueuedTimer | undefined {
    if (this.items.length === 0) return undefined;
    const first = required(this.items[0], "timer queue head");
    const lastIndex = this.items.length - 1;
    if (lastIndex > 0) {
      const last = required(this.items[lastIndex], "timer queue entry");
      this.items.pop();
      this.items[0] = last;
      this.siftDown(0);
    } else {
      this.items.pop();
    }
    return first;
  }

  /** Drops every timer matching `predicate`, re-heapifying the rest. */
  remove(predicate: (timer: QueuedTimer) => boolean): void {
    const kept = this.items.filter((t) => !predicate(t));
    this.items = kept;
    for (let i = (kept.length >> 1) - 1; i >= 0; --i) this.siftDown(i);
  }

  private siftUp(index: number): void {
    const item = required(this.items[index], "timer queue entry");
    let i = index;
    while (i > 0) {
      const parentIndex = (i - 1) >> 1;
      const parent = required(this.items[parentIndex], "timer queue entry");
      if (!firesBefore(item, parent)) break;
      this.items[i] = parent;
      i = parentIndex;
    }
    this.items[i] = item;
  }

  private siftDown(index: number): void {
    const item = required(this.items[index], "timer queue entry");
    const n = this.items.length;
    let i = index;
    for (;;) {
      const left = (i << 1) + 1;
      if (left >= n) break;
      const right = left + 1;
      const leftItem = required(this.items[left], "timer queue entry");
      let best = left;
      if (right < n && firesBefore(required(this.items[right], "timer queue entry"), leftItem)) {
        best = right;
      }
      const bestItem = required(this.items[best], "timer queue entry");
      if (!firesBefore(bestItem, item)) break;
      this.items[i] = bestItem;
      i = best;
    }
    this.items[i] = item;
  }
}
