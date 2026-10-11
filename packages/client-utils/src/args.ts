/** Result of parsing command line arguments: the value, or the message to print. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** True for an integer from `min` to `max` inclusive. */
export const between = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;
