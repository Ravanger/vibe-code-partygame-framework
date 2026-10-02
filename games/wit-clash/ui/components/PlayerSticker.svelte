<script lang="ts">
import { playerSticker, type StickerShape, stickerLetter } from "../playerSticker.js";

const {
  name,
  playerId,
  size = 44,
  ghost = false,
}: { name: string; playerId: string; size?: number; ghost?: boolean } = $props();

const SHAPES: Record<StickerShape, string> = {
  blob: "M50 6C72 4 94 22 94 48c0 26-20 46-44 46S6 76 6 50C6 24 28 8 50 6z",
  star: "M50 4L62 34L94 36L69 56L77 87L50 70L23 87L31 56L6 36L38 34z",
  flower:
    "M60 50a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM45 75a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM17 75a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM2 50a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM16 25a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM45 25a19 19 0 1 0 38 0a19 19 0 1 0 -38 0zM32 50a18 18 0 1 0 36 0a18 18 0 1 0 -36 0z",
  cloud:
    "M8 58a20 20 0 1 0 40 0a20 20 0 1 0 -40 0zM26 42a24 24 0 1 0 48 0a24 24 0 1 0 -48 0zM52 58a20 20 0 1 0 40 0a20 20 0 1 0 -40 0zM28 58v22h44v-22z",
  heart: "M50 92C20 68 8 50 8 33C8 18 20 8 32 8c8 0 14 4 18 12c4-8 10-12 18-12 12 0 24 10 24 25 0 17-12 35-42 59z",
  burst:
    "M50 4L59 17L73 10L74 26L90 27L83 41L96 50L83 59L90 73L74 74L73 90L59 83L50 96L41 83L27 90L26 74L10 73L17 59L4 50L17 41L10 27L26 26L27 10L41 17z",
};

const sticker = $derived(playerSticker(playerId));
</script>

<svg
  class="player-sticker"
  class:ghost
  viewBox="-8 -8 116 116"
  aria-hidden="true"
  style:--size={`${size}px`}
  style:--fill={ghost ? "var(--disabled)" : sticker.color}
>
  <path class="ink" d={SHAPES[sticker.shape]} />
  <path class="cut" d={SHAPES[sticker.shape]} />
  <path class="fill" d={SHAPES[sticker.shape]} />
  <text x="50" y="52" text-anchor="middle" dominant-baseline="central">{ghost ? "?" : stickerLetter(name)}</text>
</svg>

<style>
  .player-sticker {
    flex-shrink: 0;
    width: calc(var(--size) * var(--scale, 1));
    height: calc(var(--size) * var(--scale, 1));
    overflow: visible;
  }

  .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 11;
    stroke-linejoin: round;
  }

  .cut {
    fill: none;
    stroke: var(--white);
    stroke-width: 7;
    stroke-linejoin: round;
  }

  .fill {
    fill: var(--fill);
  }

  text {
    fill: var(--ink);
    font-family: var(--font-display);
    font-size: 46px;
    user-select: none;
  }

  .ghost .ink {
    stroke-dasharray: 8 6;
  }

  .ghost text {
    fill: var(--ink-soft);
  }
</style>
