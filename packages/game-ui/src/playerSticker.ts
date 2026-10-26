export const STICKER_SHAPES = ["blob", "star", "flower", "cloud", "heart", "burst"] as const;
export type StickerShape = (typeof STICKER_SHAPES)[number];

const STICKER_COLOR_COUNT = 4;

export interface PlayerSticker {
  shape: StickerShape;
  /** 0..3; `PlayerSticker.svelte` sets it as `data-color` and the theme contract maps it to a palette variable. */
  colorIndex: number;
}

export function playerSticker(playerId: string): PlayerSticker {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [shape = "blob"] = STICKER_SHAPES.slice(hash % STICKER_SHAPES.length).slice(0, 1);
  return { shape, colorIndex: Math.floor(hash / STICKER_SHAPES.length) % STICKER_COLOR_COUNT };
}

export function stickerLetter(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? "?" : first.toUpperCase();
}
