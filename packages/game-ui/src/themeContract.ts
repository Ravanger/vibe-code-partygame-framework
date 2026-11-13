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
  "--fs-6",
  "--font-display",
  "--font-hand",
  "--font-body",
  "--outline",
  "--radius-card",
  "--radius-btn",
  "--radius-pill",
  "--scrap-shadow",
  "--podium-block-height-1",
  "--podium-block-height-2",
  "--podium-block-height-3",
  "--scale",
  "--timer-size",
  "--screen-pad-x",
  "--screen-pad-y",
] as const;

/**
 * The global classes framework components render without styling them themselves, and that
 * neither `theme-contract.css` nor `base.css` ships: a game's stylesheet must define every one of
 * them so the components render as designed. These are the app-shell faces `GameShell` renders
 * (the wordmark and room chip). tests/themeContract.test.ts derives this list from the
 * components' markup; the CLI template test asserts the scaffolded app.css defines it.
 */
export const REQUIRED_GLOBAL_CLASSES = ["room-chip", "wordmark"] as const;
