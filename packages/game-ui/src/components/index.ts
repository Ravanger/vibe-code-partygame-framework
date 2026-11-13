export {
  /** A bottom bar that holds a screen's action buttons. */
  default as ActionBar,
} from "./ActionBar.svelte";
export {
  /** A menu button with a popover to leave the game and, for the host, end it after a confirmation. */
  default as GameControls,
} from "./GameControls.svelte";
export {
  /**
   * The shared app shell: header (wordmark snippet, room code, `GameControls`), reconnecting
   * status, error toast, routed screen and phase banner. On a screen change it moves focus to
   * the first heading matching `headingSelector` (default `.screen h1, .screen h2`) inside the
   * screen — skipping the initial mount and a form field that just mounted — sets
   * `tabindex="-1"` on a heading that lacks one, and falls back to the `.screen` container when
   * no heading matches. The focused heading and the polite live region are both announced by
   * design: the heading names the screen, the banner announces the phase moment.
   */
  default as GameShell,
} from "./GameShell.svelte";
export {
  /**
   * The whole lobby screen: notice, name card (first while unnamed), room code with copy button
   * and QR code for the host and spectators, the waiting panel for named guests, the player list
   * with badges and kick confirmation, an optional `settings` form, an optional `extra` snippet
   * rendered below it, leave and — for the host — the start button. Every label comes from the
   * `UiStrings` table; the chips (`chip`, `chip--sky`, `chip--paper`) are styled by the game.
   */
  default as LobbyScreen,
} from "./LobbyScreen.svelte";
export {
  /** The lobby's collapsible options form: editable fields for the host, read-only values for everyone else. */
  default as LobbySettings,
} from "./LobbySettings.svelte";
export {
  /** A labelled text input bound to a `NameField` that lets the player set their name. */
  default as NameInput,
} from "./NameInput.svelte";
export {
  /** A player's sticker: a shape and color derived from `playerId` with the name's first letter, or a question mark when `ghost`. */
  default as PlayerSticker,
} from "./PlayerSticker.svelte";
export {
  /** The top three rank groups as podium steps, with an optional `extra` snippet per player. */
  default as Podium,
} from "./Podium.svelte";
export {
  /** An SVG QR code encoding `text`. */
  default as QrCode,
} from "./QrCode.svelte";
export {
  /** A button that toggles a `SoundPolicy` between its `on` and `off` labels. */
  default as SoundToggle,
} from "./SoundToggle.svelte";
export {
  /** A taped card with a `title`, optional `detail` and a `tone` of `wait`, `done` or `info`. */
  default as StatusPanel,
} from "./StatusPanel.svelte";
export {
  /** A burning-fuse countdown showing `seconds` left of `total`, urgent in the last ten seconds, with an `announcement` for screen readers. */
  default as Timer,
} from "./Timer.svelte";
export {
  /**
   * The entry screen: a wordmark title and tagline (or a `hero` snippet replacing them), host
   * button, a join-by-code input and a watch-on-a-TV button, plus a dismissible local error.
   * Triggers `vm.autoJoinIfRequested()` once on mount so share links (`?code=`) and TV links
   * (`?tv=`) connect without a click. The wordmark face (font, tape) is themed by the game's
   * global `.screen .wordmark` rule.
   */
  default as WelcomeScreen,
} from "./WelcomeScreen.svelte";
