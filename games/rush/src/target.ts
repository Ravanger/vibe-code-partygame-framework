/** The side of the square race field in cells; the target bounces inside [0, GRID]. */
export const GRID = 10;

/** The center zone a TAP must land in to score: the 1x1 square around the grid center. */
export const inZone = (x: number, y: number): boolean =>
  Math.abs(x - GRID / 2) <= 0.5 && Math.abs(y - GRID / 2) <= 0.5;

/** The target's position in cells and velocity in cells per second. */
export interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const pickSpeed = (rng: () => number): number =>
  (2 + Math.floor(rng() * 3)) * (rng() < 0.5 ? -1 : 1);

/** Deals a target at a random position with a random speed of 2-4 cells/s per axis. */
export const dealTarget = (rng: () => number): Target => ({
  x: rng() * GRID,
  y: rng() * GRID,
  vx: pickSpeed(rng),
  vy: pickSpeed(rng),
});

/** Advances the target by dtMs, reflecting it off the edges of the grid. */
export const stepTarget = (target: Target, dtMs: number): Target => {
  let x = target.x + (target.vx * dtMs) / 1000;
  let y = target.y + (target.vy * dtMs) / 1000;
  let vx = target.vx;
  let vy = target.vy;
  if (x < 0) {
    x = -x;
    vx = -vx;
  } else if (x > GRID) {
    x = GRID * 2 - x;
    vx = -vx;
  }
  if (y < 0) {
    y = -y;
    vy = -vy;
  } else if (y > GRID) {
    y = GRID * 2 - y;
    vy = -vy;
  }
  return { x, y, vx, vy };
};
