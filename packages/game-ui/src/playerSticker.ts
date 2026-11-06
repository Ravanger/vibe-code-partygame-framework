/** The shapes a player sticker can take. */
export const STICKER_SHAPES = ["blob", "star", "flower", "cloud", "heart", "burst"] as const;
/** One of `STICKER_SHAPES`. */
export type StickerShape = (typeof STICKER_SHAPES)[number];

// theme-contract.css maps [data-color="0"]..[data-color="3"] to --color-1..--color-4.
const STICKER_COLOR_COUNT = 4;

/** A player's sticker: a shape and an index into the theme's four sticker colors. */
export interface PlayerSticker {
  shape: StickerShape;
  colorIndex: number;
}

/** The sticker for a player id; the same id always yields the same sticker. */
export function playerSticker(playerId: string): PlayerSticker {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [shape = "blob"] = STICKER_SHAPES.slice(hash % STICKER_SHAPES.length);
  const colorIndex = Math.floor(hash / STICKER_SHAPES.length) % STICKER_COLOR_COUNT;
  return { shape, colorIndex };
}

/** The upper-cased first character of a name, or "?" for an empty one. */
export function stickerLetter(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? "?" : first.toUpperCase();
}
