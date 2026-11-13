export {
  /** A bottom bar that holds a screen's action buttons. */
  default as ActionBar,
} from "./ActionBar.svelte";
export {
  /**
   * Tappable choices in a grid. The player's current pick is rendered pressed (`aria-pressed`)
   * with the `UiStrings.pickedStamp` stamp; the player's own item (`own`) is never votable and
   * carries the `UiStrings.yours` chip; every choice is disabled while `canVote` is false. An
   * optional `versus` label renders a divider between the first two choices, an optional
   * per-choice `label` a badge letter, and a switch hint (`UiStrings.switchHint`) appears while
   * a pick can still be changed.
   */
  default as ChoiceBoard,
} from "./ChoiceBoard.svelte";
export {
  /** Falling confetti: `count` deterministic pieces across the top of the screen, coloured by theme variables; animated only under `prefers-reduced-motion: no-preference`. */
  default as Confetti,
} from "./Confetti.svelte";
export {
  /**
   * A multi-line text entry with a character counter and Enter-to-submit: the textarea is named
   * by `label`, capped at `maxLength` characters, and reports edits through `oninput`; Enter
   * (not Shift+Enter) calls `onsubmit`. The counter shows the `remaining` characters through
   * `UiStrings.charsLeft` and turns low under 20; an optional `rejection` renders in a live
   * alert above the box.
   */
  default as DraftBox,
} from "./DraftBox.svelte";
export {
  /**
   * The host's "Export replay" button: sends the host-only `EXPORT_REPLAY` request through
   * `manager.exportReplay()` and downloads the answer as `<name>-replay.json` (the bundle's game
   * name lower-cased, or `replay` when it has none); a refusal downloads nothing.
   */
  default as ExportReplayButton,
} from "./ExportReplayButton.svelte";
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
   * The how-to-play sheet over a game's `steps` (`{ title, body, illustration?, example? }`). A
   * seated player gets a dialog — auto-opened once per browser (the seen flag under
   * `${storagePrefix}.howToPlaySeen`), focus-trapped, with the background inert, closed by
   * Escape or the close button, and focus returned to the opener; a seatless viewer gets an
   * auto-advancing carousel that never takes focus or blocks the lobby and stops for good on
   * user input. Navigation is next/back plus a dot row; renders nothing without steps.
   * @experimental How-to-play API; may change before 1.0.
   */
  default as HowToPlay,
} from "./HowToPlay.svelte";
export {
  /** The "How to play" button that opens the sheet through a shared `HowToPlayViewModel`. @experimental How-to-play API; may change before 1.0. */
  default as HowToPlayButton,
} from "./HowToPlayButton.svelte";
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
  /** A "next up in Ns" label over a draining track, both driven by a `PhaseClock`; the label comes from `UiStrings.nextUpIn`. */
  default as PhaseBar,
} from "./PhaseBar.svelte";
export {
  /** The phase's burning-fuse countdown: renders the `Timer` from a `PhaseClock`'s seconds, fraction and announcement. */
  default as PhaseTimer,
} from "./PhaseTimer.svelte";
export {
  /** A player's sticker: a shape and color derived from `playerId` with the name's first letter, or a question mark when `ghost`. */
  default as PlayerSticker,
} from "./PlayerSticker.svelte";
export {
  /** The top three rank groups as podium steps, with an optional `extra` snippet per player. */
  default as Podium,
} from "./Podium.svelte";
export {
  /**
   * A strip of player stickers showing who has handed everything in (`UiStrings.done` mark),
   * who is working right now (`UiStrings.typing`) and each row's answered count; the list is
   * named by `label`. Renders nothing for an empty `rows`.
   */
  default as ProgressStrip,
} from "./ProgressStrip.svelte";
export {
  /** An SVG QR code encoding `text`. */
  default as QrCode,
} from "./QrCode.svelte";
export {
  /**
   * The offline replay viewer: a file picker for a bundle exported by the host, then the game's
   * own screens rendered read-only over its snapshots with previous/next/play controls and a
   * scrubber. Takes `screens` (a phase-name-to-`{ component }` record, the same shape as the
   * game's `PHASE_SCREENS`), the game's synced `stateClass` and a `title` for the header wordmark
   * (themed by the game's `header .wordmark` rule). A snapshot whose phase is missing from
   * `screens` falls back to a message; an invalid bundle shows its error. Mount it through
   * `mountReplayIfRequested` so only a `?replay` URL opens it.
   */
  default as ReplayViewer,
} from "./ReplayViewer.svelte";
export {
  /** A screen heading: a focusable `h1` with a wavy underline and an optional hand-written `hint`. */
  default as ScreenTitle,
} from "./ScreenTitle.svelte";
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
