export const STICKER_SHAPES = ["blob", "star", "flower", "cloud", "heart", "burst"] as const;
export type StickerShape = (typeof STICKER_SHAPES)[number];

const STICKER_COLORS = ["var(--color-1)", "var(--color-2)", "var(--color-3)", "var(--color-4)"];

export interface PlayerSticker {
  shape: StickerShape;
  color: string;
}

export function playerSticker(playerId: string): PlayerSticker {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [shape = "blob"] = STICKER_SHAPES.slice(hash % STICKER_SHAPES.length);
  const colorIndex = Math.floor(hash / STICKER_SHAPES.length) % STICKER_COLORS.length;
  const [color = ""] = STICKER_COLORS.slice(colorIndex);
  return { shape, color };
}

export function stickerLetter(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? "?" : first.toUpperCase();
}
