export {
  /** A bottom bar that holds a screen's action buttons. */
  default as ActionBar,
} from "./ActionBar.svelte";
export {
  /** A menu button with a popover to leave the game and, for the host, end it after a confirmation. */
  default as GameControls,
} from "./GameControls.svelte";
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
