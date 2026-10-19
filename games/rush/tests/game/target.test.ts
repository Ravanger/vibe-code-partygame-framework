import { describe, expect, it } from "vitest";
import { dealTarget, GRID, inZone, stepTarget } from "../../src/target.js";

/** A deterministic rng cycling through fixed values, for controlled dealing. */
const cycling = (values: number[]): (() => number) => {
  let i = 0;
  return () => {
    const value = values[i % values.length];
    ++i;
    if (value === undefined) throw new Error("cycling rng exhausted");
    return value;
  };
};

describe("inZone", () => {
  it("scores the center cell and the edges of the 1x1 square", () => {
    expect(inZone(GRID / 2, GRID / 2)).toBe(true);
    expect(inZone(GRID / 2 - 0.5, GRID / 2)).toBe(true);
    expect(inZone(GRID / 2 + 0.5, GRID / 2)).toBe(true);
    expect(inZone(GRID / 2, GRID / 2 - 0.5)).toBe(true);
    expect(inZone(GRID / 2, GRID / 2 + 0.5)).toBe(true);
  });

  it("misses just outside the square and in the corners", () => {
    expect(inZone(GRID / 2 - 0.51, GRID / 2)).toBe(false);
    expect(inZone(GRID / 2, GRID / 2 + 0.51)).toBe(false);
    expect(inZone(0, 0)).toBe(false);
  });
});

describe("dealTarget", () => {
  it("deals the position from the first two draws and positive speeds", () => {
    const target = dealTarget(cycling([0.25, 0.75, 0.1, 0.9, 0.4, 0.6]));
    expect(target.x).toBe(2.5);
    expect(target.y).toBe(7.5);
    // vx: magnitude 2 + floor(0.1 * 3) = 2, sign from 0.9 (>= 0.5) is positive.
    expect(target.vx).toBe(2);
    // vy: magnitude 2 + floor(0.4 * 3) = 3, sign from 0.6 (>= 0.5) is positive.
    expect(target.vy).toBe(3);
  });

  it("deals negative speeds for sign draws below 0.5", () => {
    const target = dealTarget(cycling([0, 0, 0.5, 0.2, 0.5, 0.49]));
    expect(target.x).toBe(0);
    expect(target.y).toBe(0);
    // vx: magnitude 2 + floor(0.5 * 3) = 3, sign from 0.2 (< 0.5) is negative.
    expect(target.vx).toBe(-3);
    // vy: magnitude 2 + floor(0.5 * 3) = 3, sign from 0.49 (< 0.5) is negative.
    expect(target.vy).toBe(-3);
  });
});

describe("stepTarget", () => {
  it("moves by velocity times dt without bouncing mid-grid", () => {
    expect(stepTarget({ x: 5, y: 5, vx: 4, vy: -4 }, 125)).toEqual({
      x: 5.5,
      y: 4.5,
      vx: 4,
      vy: -4,
    });
  });

  it("reflects off the left and right edges", () => {
    expect(stepTarget({ x: 0.25, y: 5, vx: -4, vy: 2 }, 125)).toEqual({
      x: 0.25,
      y: 5.25,
      vx: 4,
      vy: 2,
    });
    expect(stepTarget({ x: 9.75, y: 5, vx: 4, vy: 2 }, 125)).toEqual({
      x: 9.75,
      y: 5.25,
      vx: -4,
      vy: 2,
    });
  });

  it("reflects off the bottom and top edges", () => {
    expect(stepTarget({ x: 5, y: 0.25, vx: 2, vy: -4 }, 125)).toEqual({
      x: 5.25,
      y: 0.25,
      vx: 2,
      vy: 4,
    });
    expect(stepTarget({ x: 5, y: 9.75, vx: 2, vy: 4 }, 125)).toEqual({
      x: 5.25,
      y: 9.75,
      vx: 2,
      vy: -4,
    });
  });
});
