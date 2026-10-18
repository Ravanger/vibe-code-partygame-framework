import { describe, expect, it } from "vitest";
import { dailyRng, utcDay } from "../../src/dailySeed.js";

describe("utcDay", () => {
  it("is the UTC date of a timestamp", () => {
    expect(utcDay(Date.UTC(2026, 9, 15, 6, 30))).toBe("2026-10-15");
  });

  it("turns over at UTC midnight", () => {
    expect(utcDay(Date.UTC(2026, 9, 15, 23, 59, 59, 999))).toBe("2026-10-15");
    expect(utcDay(Date.UTC(2026, 9, 16, 0, 0, 0))).toBe("2026-10-16");
  });
});

describe("dailyRng", () => {
  it("is identical for the same day and salt", () => {
    const a = dailyRng("2026-10-15", "categories");
    const b = dailyRng("2026-10-15", "categories");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs for another day", () => {
    const a = dailyRng("2026-10-15", "categories");
    const b = dailyRng("2026-10-16", "categories");
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("differs for another salt, including numeric salts", () => {
    const a = dailyRng("2026-10-15", "categories");
    expect([a(), a(), a()]).not.toEqual(
      (() => {
        const b = dailyRng("2026-10-15", 1);
        return [b(), b(), b()];
      })(),
    );
  });
});
