import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/RateLimiter.js";

const bucket = { rate: 10, burst: 2 };

describe("RateLimiter", () => {
  it("allows a fresh key up to its burst, then refuses in enforce mode", () => {
    const now = 1_000;
    const limiter = new RateLimiter({ clock: () => now });
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(false);
  });

  it("refills at the bucket's rate and caps at its burst", () => {
    let now = 1_000;
    const limiter = new RateLimiter({ clock: () => now });
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(true);
    now += 100; // 10/s -> one token
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(false);
    now += 900; // long idle: the refill caps at the burst of two
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(false);
  });

  it("keeps one bucket per key", () => {
    const now = 1_000;
    const limiter = new RateLimiter({ clock: () => now });
    expect(limiter.take("room:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room:p1:ACTION", bucket)).toBe(false);
    // a different key is unaffected
    expect(limiter.take("room:p2:ACTION", bucket)).toBe(true);
  });

  it("drop(prefix) frees matching keys and leaves the others", () => {
    const now = 1_000;
    const limiter = new RateLimiter({ clock: () => now });
    // exhaust both keys (a burst of two)
    expect(limiter.take("room1:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room1:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room1:p1:ACTION", bucket)).toBe(false);
    expect(limiter.take("room2:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room2:p1:ACTION", bucket)).toBe(true);
    expect(limiter.take("room2:p1:ACTION", bucket)).toBe(false);
    limiter.drop("room1:");
    expect(limiter.take("room1:p1:ACTION", bucket)).toBe(true); // freed by the drop
    expect(limiter.take("room2:p1:ACTION", bucket)).toBe(false); // untouched
  });

  it("observe mode never refuses and reports each refused take through onObserve", () => {
    const now = 1_000;
    const seen: string[] = [];
    const limiter = new RateLimiter({
      clock: () => now,
      mode: "observe",
      onObserve: (key) => {
        seen.push(key);
      },
    });
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(true);
    expect(limiter.take("a", bucket)).toBe(true); // over the limit, but only observed
    expect(seen).toEqual(["a"]);
  });

  it("observe mode without a callback does not throw", () => {
    const limiter = new RateLimiter({ mode: "observe" });
    const dry = { rate: 0, burst: 1 };
    expect(limiter.take("a", dry)).toBe(true);
    expect(limiter.take("a", dry)).toBe(true); // refused in enforce mode, observed here
  });

  it("defaults to Date.now and enforce mode", () => {
    const limiter = new RateLimiter();
    const once = { rate: 1, burst: 1 };
    expect(limiter.take("a", once)).toBe(true);
    expect(limiter.take("a", once)).toBe(false); // enforce by default
  });

  describe("memory bound", () => {
    it("evicts refilled buckets once the map grows past sweepAt, like they were never seen", () => {
      let now = 0;
      const limiter = new RateLimiter({ clock: () => now, sweepAt: 4 });
      for (let i = 0; i < 4; ++i) expect(limiter.take(`k${i}`, bucket)).toBe(true);
      now += 1000; // at 10/s each of them refills to its burst of two long before this
      expect(limiter.take("k5", bucket)).toBe(true); // the fifth key grows the map past sweepAt and sweeps
      expect(limiter.size).toBe(1); // k0..k3 were refilled to full and swept; only k5 remains
      // an evicted key behaves exactly like a never-seen one
      expect(limiter.waitMs("k0", bucket)).toBe(0);
      expect(limiter.take("k0", bucket)).toBe(true);
      expect(limiter.take("k0", bucket)).toBe(true);
      expect(limiter.take("k0", bucket)).toBe(false); // fresh burst of two, as if new
    });

    it("keeps non-refilled buckets during a sweep", () => {
      let now = 0;
      const limiter = new RateLimiter({ clock: () => now, sweepAt: 2 });
      const frozen = { rate: 0, burst: 1 }; // never refills, so it can never be swept
      expect(limiter.take("frozen", frozen)).toBe(true); // exhausted at t=0
      for (let i = 0; i < 5; ++i) {
        limiter.take(`gone${i}`, bucket);
        now += 1000; // each earlier "gone" key refills to full before the next one arrives
      }
      expect(limiter.size).toBe(2); // the frozen bucket plus the last fresh key
      expect(limiter.take("frozen", frozen)).toBe(false); // still exhausted: state kept, not just presence
    });

    it("does not sweep below sweepAt", () => {
      const now = 0;
      const limiter = new RateLimiter({ clock: () => now, sweepAt: 4 });
      for (let i = 0; i < 4; ++i) limiter.take(`k${i}`, bucket);
      expect(limiter.size).toBe(4); // at the threshold, not past it
    });
  });

  describe("waitMs", () => {
    it("is 0 for a key that has never been seen", () => {
      const limiter = new RateLimiter({ clock: () => 1_000 });
      expect(limiter.waitMs("a", bucket)).toBe(0); // a fresh key starts full
    });

    it("is 0 while the key still holds a token", () => {
      const now = 1_000;
      const limiter = new RateLimiter({ clock: () => now });
      expect(limiter.take("a", bucket)).toBe(true); // burst of two -> one left
      expect(limiter.waitMs("a", bucket)).toBe(0);
    });

    it("counts to the next token once exhausted, and shrinks as time passes", () => {
      let now = 1_000;
      const limiter = new RateLimiter({ clock: () => now });
      expect(limiter.take("a", bucket)).toBe(true);
      expect(limiter.take("a", bucket)).toBe(true);
      expect(limiter.take("a", bucket)).toBe(false); // exhausted at t=1000
      expect(limiter.waitMs("a", bucket)).toBe(100); // 10/s -> one token in 100 ms
      now += 50;
      expect(limiter.waitMs("a", bucket)).toBe(50); // half a token has refilled
      now += 500;
      expect(limiter.waitMs("a", bucket)).toBe(0); // refilled in the meantime
    });

    it("is Infinity for an exhausted rate-0 bucket", () => {
      const limiter = new RateLimiter({ clock: () => 1_000 });
      const dry = { rate: 0, burst: 1 };
      expect(limiter.take("a", dry)).toBe(true);
      expect(limiter.waitMs("a", dry)).toBe(Number.POSITIVE_INFINITY);
    });
  });
});
