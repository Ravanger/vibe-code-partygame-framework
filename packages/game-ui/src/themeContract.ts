/** Every custom property the theme contract (`theme-contract.css`) defines on `:root`. */
export const CONTRACT_VARIABLES = [
  "--ink",
  "--ink-soft",
  "--white",
  "--paper",
  "--color-1",
  "--color-2",
  "--color-3",
  "--color-4",
  "--accent",
  "--danger",
  "--disabled",
  "--tape-1",
  "--tape-2",
  "--tape-3",
  "--tape-4",
  "--fs-1",
  "--fs-2",
  "--fs-3",
  "--fs-4",
  "--fs-5",
  "--font-display",
  "--outline",
  "--radius-card",
  "--radius-btn",
  "--scrap-shadow",
  "--podium-block-height-1",
  "--podium-block-height-2",
  "--podium-block-height-3",
  "--scale",
  "--timer-size",
] as const;

/**
 * The global classes framework components render without styling them themselves, and that
 * `theme-contract.css` does not ship: a game's stylesheet must define every one of them so the
 * components render as designed. All are required except `action-bar`, which only games that
 * render `ActionBar` need. tests/themeContract.test.ts derives this list from the components'
 * markup; the CLI template test asserts the scaffolded app.css defines it.
 */
export const REQUIRED_GLOBAL_CLASSES = [
  "action-bar",
  "btn",
  "btn--big",
  "btn--danger",
  "btn--ghost",
  "btn--primary",
  "btn--secondary",
  "card",
  "chip",
  "chip--paper",
  "chip--sky",
  "hand",
  "room-chip",
  "stack",
  "sticker",
  "taped",
  "wordmark",
] as const;
