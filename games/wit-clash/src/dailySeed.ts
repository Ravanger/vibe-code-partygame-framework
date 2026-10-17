import { mulberry32 } from "@partygame/core";

/** The UTC date of an epoch-ms timestamp, as `YYYY-MM-DD`. */
export function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** FNV-1a 32-bit hash of a string, as an unsigned 32-bit integer. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; ++i) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The deterministic content RNG for one UTC date and salt: the FNV-1a hash of `${day}:${salt}`
 * seeds `mulberry32`, so every server on the same date draws the same sequence, whatever its room
 * seed. Daily mode uses it for the category order (salt `"categories"`) and per-round prompt
 * dealing (salt the round number).
 */
export function dailyRng(day: string, salt: string | number): () => number {
  return mulberry32(fnv1a(`${day}:${salt}`));
}
