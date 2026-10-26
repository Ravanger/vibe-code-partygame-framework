/**
 * The theme variables the `@partygame/game-ui` components read. `theme-contract.css` ships a
 * baseline for each of them; a game overrides any of them in its own stylesheet after importing
 * the contract. Pinned by `tests/themeContract.test.ts`, which also checks that the README lists
 * exactly these variables.
 */
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
  "--scale",
  "--timer-size",
  "--podium-block-height-1",
  "--podium-block-height-2",
  "--podium-block-height-3",
] as const;
