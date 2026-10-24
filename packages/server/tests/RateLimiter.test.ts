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
});
