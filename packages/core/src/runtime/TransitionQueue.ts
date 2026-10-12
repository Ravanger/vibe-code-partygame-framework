const MAX_CHAINED_TRANSITIONS = 100;

/** A phase transition requested from inside a hook or handler, applied once that call returns. */
export type Pending = { kind: "phase"; phase: string } | { kind: "lobby" };

/**
 * FIFO queue of pending transitions with a loop guard: a drain applies items one by one — including
 * items pushed while applying — and throws on the 101st step.
 */
export class TransitionQueue {
  private readonly items: Pending[] = [];

  /** Queue a transition to apply during the current run's drain. */
  push(pending: Pending): void {
    this.items.push(pending);
  }

  /** Discard every pending transition (room stop, or an error unwinding the run). */
  clear(): void {
    this.items.length = 0;
  }

  /** True when no transition is pending. */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Apply queued transitions FIFO, including ones pushed while applying. `afterEach` runs after
   * every apply so the runtime can surface hook failures between steps. Throws on the 101st step,
   * and discards whatever is still queued whenever a step throws.
   */
  drain(apply: (next: Pending) => void, afterEach: () => void): void {
    let steps = 0;
    try {
      for (let next = this.items.shift(); next; next = this.items.shift()) {
        if (++steps > MAX_CHAINED_TRANSITIONS) {
          throw new Error(`More than ${MAX_CHAINED_TRANSITIONS} chained transitions; phase loop?`);
        }
        apply(next);
        afterEach();
      }
    } catch (error) {
      this.clear();
      throw error;
    }
  }
}
