/** Sustained refill (tokens per second) and burst capacity of one bucket. */
export interface TokenBucket {
  /** Tokens added per second while the bucket is below capacity. */
  rate: number;
  /** Maximum tokens held at once; a fresh key starts full. */
  burst: number;
}

/** Per-purpose limits for `GameServerOptions.rateLimits`. */
export interface RateLimits {
  /** Actions per player. Default 10/s, burst 20. */
  action?: TokenBucket;
  /** SET_NAME per player. Default 2/s, burst 2. */
  setName?: TokenBucket;
  /** `/api/resolve-code` per remote address. Default 1/s, burst 10. */
  resolveCode?: TokenBucket;
  /** "enforce" refuses over-limit traffic; "observe" only reports it. Default "enforce". */
  mode?: "observe" | "enforce";
}

/** {@link RateLimits} with every field resolved to a concrete value. */
export interface ResolvedRateLimits {
  action: TokenBucket;
  setName: TokenBucket;
  resolveCode: TokenBucket;
  mode: "observe" | "enforce";
}

interface BucketState {
  tokens: number;
  lastSeen: number;
}

/**
 * Token-bucket rate limiter with an injectable clock (milliseconds, monotonic). Keys are opaque —
 * the room passes `(roomId, playerId, messageType)` so a reconnect cannot reset a bucket. In
 * observe mode an exhausted take is reported through `onObserve` and still allowed; enforce mode
 * refuses it.
 */
export class RateLimiter {
  private readonly clock: () => number;
  private readonly mode: "observe" | "enforce";
  private readonly onObserve: (key: string) => void;
  private readonly buckets = new Map<string, BucketState>();

  constructor(
    options: {
      clock?: () => number;
      mode?: "observe" | "enforce";
      onObserve?: (key: string) => void;
    } = {},
  ) {
    this.clock = options.clock ?? Date.now;
    this.mode = options.mode ?? "enforce";
    this.onObserve = options.onObserve ?? (() => {});
  }

  /** Take one token for `key` under `bucket`; false only when exhausted in enforce mode. */
  take(key: string, bucket: TokenBucket): boolean {
    const now = this.clock();
    let state = this.buckets.get(key);
    if (state === undefined) {
      state = { tokens: bucket.burst, lastSeen: now };
      this.buckets.set(key, state);
    } else {
      state.tokens = Math.min(
        bucket.burst,
        state.tokens + ((now - state.lastSeen) * bucket.rate) / 1000,
      );
      state.lastSeen = now;
    }
    if (state.tokens >= 1) {
      state.tokens -= 1;
      return true;
    }
    if (this.mode === "observe") {
      this.onObserve(key);
      return true;
    }
    return false;
  }

  /**
   * Milliseconds until `key` holds at least one token under `bucket`, counting the refill that has
   * already happened: 0 when it already does or has never been seen, Infinity for an exhausted
   * rate-0 bucket. Does not consume a token.
   */
  waitMs(key: string, bucket: TokenBucket): number {
    const state = this.buckets.get(key);
    if (state === undefined) return 0;
    const now = this.clock();
    const tokens = Math.min(
      bucket.burst,
      state.tokens + ((now - state.lastSeen) * bucket.rate) / 1000,
    );
    if (tokens >= 1) return 0;
    if (bucket.rate <= 0) return Number.POSITIVE_INFINITY;
    return Math.ceil(((1 - tokens) * 1000) / bucket.rate);
  }

  /** Forget every key starting with `prefix` (e.g. all of a room's keys when it is disposed). */
  drop(prefix: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix)) this.buckets.delete(key);
    }
  }
}
