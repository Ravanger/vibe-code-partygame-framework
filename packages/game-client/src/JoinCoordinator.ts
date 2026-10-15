export const CANCELLED = "Connection cancelled";

/**
 * Single-flight joining with generation-based cancellation: concurrent runs sharing a key get one
 * promise, and a run superseded by a newer run or `cancel()` rejects with the cancelled error.
 */
export class JoinCoordinator {
  private pending: { key: string; promise: Promise<void> } | undefined;
  private generation = 0;

  /** Runs `open` under single flight per key; the `cancelled()` probe reports whether this run was superseded. */
  async run(key: string, open: (cancelled: () => boolean) => Promise<void>): Promise<void> {
    if (this.pending?.key === key) return this.pending.promise;
    const generation = ++this.generation;
    const cancelled = (): boolean => generation !== this.generation;
    const entry = { key, promise: this.guarded(cancelled, open) };
    this.pending = entry;
    try {
      await entry.promise;
    } finally {
      if (this.pending === entry) this.pending = undefined;
    }
  }

  /** Cancels the in-flight run and forgets the pending entry. */
  cancel(): void {
    ++this.generation;
    this.pending = undefined;
  }

  private async guarded(
    cancelled: () => boolean,
    open: (cancelled: () => boolean) => Promise<void>,
  ): Promise<void> {
    await open(cancelled);
    if (cancelled()) throw new Error(CANCELLED);
  }
}
