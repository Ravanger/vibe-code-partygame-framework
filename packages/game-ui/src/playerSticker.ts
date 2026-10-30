export const STICKER_SHAPES = ["blob", "star", "flower", "cloud", "heart", "burst"] as const;
export type StickerShape = (typeof STICKER_SHAPES)[number];

// theme-contract.css maps [data-color="0"]..[data-color="3"] to --color-1..--color-4.
const STICKER_COLOR_COUNT = 4;

export interface PlayerSticker {
  shape: StickerShape;
  colorIndex: number;
}

export function playerSticker(playerId: string): PlayerSticker {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [shape = "blob"] = STICKER_SHAPES.slice(hash % STICKER_SHAPES.length);
  const colorIndex = Math.floor(hash / STICKER_SHAPES.length) % STICKER_COLOR_COUNT;
  return { shape, colorIndex };
}

export function stickerLetter(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? "?" : first.toUpperCase();
}
