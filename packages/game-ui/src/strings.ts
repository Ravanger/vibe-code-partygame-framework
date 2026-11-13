import type { ClientStrings } from "@partygame/game-client";
import type { ErrorCode } from "@partygame/shared";
import { getContext, setContext } from "svelte";

const KEY = Symbol("ui-strings");

/**
 * Every label the generic game-ui components render. A game calls {@link setStrings} once at the
 * app root with a partial table; unspecified keys keep the English default.
 */
export interface UiStrings {
  /** `aria-label` of the GameControls menu button. */
  gameMenu: string;
  /** The leave button in GameControls. */
  leaveGame: string;
  /** The end-game button in the GameControls menu. */
  endGame: string;
  /** The confirmation line before ending the game for everyone. */
  confirmEndGame: string;
  /** Confirming answer of the end-game dialog. */
  yes: string;
  /** Cancelling answer of the end-game dialog. */
  no: string;
  /** The LobbySettings summary line. */
  gameSettings: string;
  /** The NameInput label. */
  yourName: string;
  /** The NameInput placeholder. */
  enterYourName: string;
  /** `aria-label` of the Podium list. */
  podium: string;
  /** The "you" marker next to the player's own podium entry. */
  you: string;
  /** Screen-reader text of the podium you-marker. */
  thisIsYou: string;
  /** The score unit after a podium score. */
  scoreUnit: string;
  /** `aria-label` of the QrCode image. */
  qrCode: string;
  /** The SoundToggle button label; its state is conveyed by `aria-pressed`, so the label stays constant. */
  sound: string;
  /** The done sticker of StatusPanel and the ProgressStrip done mark. */
  done: string;
  /** The ProgressStrip typing label under a player who is working right now. */
  typing: string;
  /** The stamp on the picked choice in ChoiceBoard. */
  pickedStamp: string;
  /** The hint under a ChoiceBoard whose pick can still be switched. */
  switchHint: string;
  /** The chip next to the player's own item in a ChoiceBoard. */
  yours: string;
  /** Builds the DraftBox counter text from how many characters are still available. */
  charsLeft: (n: number) => string;
  /** Builds the Timer announcement for a given number of seconds left. */
  secondsRemaining: (seconds: number) => string;
  /** Builds the PhaseBar label from the seconds until the next phase starts. */
  nextUpIn: (seconds: number) => string;
  /** Builds the place label shown on a podium step for a given tier (1–3). */
  podiumPlace: (tier: number) => string;
  /** The waiting room's copy status after the room code was copied. */
  codeCopied: string;
  /** The waiting room's copy status when the clipboard is denied or unavailable. */
  codeCopyFailed: string;
  /** The lobby's room-code caption. */
  roomCodeLabel: string;
  /** The lobby's copy button. */
  copyCode: string;
  /** The lobby line under the QR code, before the share link. */
  shareInstructions: string;
  /** The lobby waiting panel's title for a named guest. */
  waitingForHost: string;
  /** Builds the lobby players heading from the ready count and the player limits. */
  playersHeading: (ready: number, min: number, max: number) => string;
  /** Builds the lobby line counting how many spectators watch on a TV. */
  watchingOnTv: (count: number) => string;
  /** The lobby name shown for a seat without a name yet. */
  choosingName: string;
  /** The badge next to the player's own lobby row. */
  youBadge: string;
  /** The badge next to the host's lobby row. */
  hostBadge: string;
  /** The badge next to a disconnected seat's lobby row. */
  disconnectedBadge: string;
  /** Builds the aria-label of a lobby row's remove button from the seat's name, or "player" when it has none. */
  removePlayer: (name: string) => string;
  /** The lobby kick confirmation question. */
  kickConfirm: string;
  /** Builds the host's start button label from the ready count and the minimum. */
  startGame: (ready: number, min: number) => string;
  /** Builds the lobby hint shown to a host below the minimum. */
  needAtLeast: (min: number) => string;
  /** The HowToPlayButton label and the how-to-play sheet's heading. */
  howToPlay: string;
  /** The how-to-play sheet's close button. */
  closeSheet: string;
  /** The how-to-play sheet's back button. */
  previousStep: string;
  /** The how-to-play sheet's next button. */
  nextStep: string;
  /** Builds the accessible name of a how-to-play step dot from its position and the total number of steps. */
  stepLabel: (current: number, total: number) => string;
  /**
   * The client-side table from `@partygame/game-client`; pass the same object to the manager's
   * `strings` option so one table covers both layers.
   */
  clientStrings: Partial<ClientStrings>;
}

/** The English defaults for every game-ui label. */
export const defaultUiStrings: UiStrings = {
  gameMenu: "Game menu",
  leaveGame: "Leave game",
  endGame: "End game",
  confirmEndGame: "End the game for everyone?",
  yes: "Yes",
  no: "No",
  gameSettings: "Game settings",
  yourName: "Your name",
  enterYourName: "Enter your name",
  podium: "Podium",
  you: "you",
  thisIsYou: "This is you",
  scoreUnit: "pts",
  qrCode: "QR code that opens the join link",
  sound: "Sound",
  done: "Done",
  typing: "typing…",
  pickedStamp: "VOTED!",
  switchHint: "psst… tap the other one to switch",
  yours: "yours",
  charsLeft: (n) => `${n} chars left`,
  secondsRemaining: (seconds) => `${seconds} seconds remaining`,
  nextUpIn: (seconds) => `Next up in ${seconds}s`,
  podiumPlace: (tier) => (tier === 1 ? "1st" : tier === 2 ? "2nd" : "3rd"),
  codeCopied: "Copied!",
  codeCopyFailed: "Copy failed, read the code out",
  roomCodeLabel: "Room Code",
  copyCode: "Copy",
  shareInstructions: "Scan to join, or open",
  waitingForHost: "Waiting for the host to start the game...",
  playersHeading: (ready, min, max) => `Players (${ready} ready, ${min} to ${max} needed)`,
  watchingOnTv: (count) => `${count} watching on a TV`,
  choosingName: "Choosing a name...",
  youBadge: "(You)",
  hostBadge: "Host",
  disconnectedBadge: "(Disconnected)",
  removePlayer: (name) => `Remove ${name}`,
  kickConfirm: "Remove?",
  startGame: (ready, min) => `Start Game (${ready}/${min})`,
  needAtLeast: (min) => `Need at least ${min} players to start`,
  howToPlay: "How to play",
  closeSheet: "Close",
  previousStep: "Back",
  nextStep: "Next",
  stepLabel: (current, total) => `Step ${current} of ${total}`,
  clientStrings: {},
};

let current: UiStrings = defaultUiStrings;

/**
 * Registers a partial table at the app root. It is stored in the Svelte context for the component
 * tree and in a module-level table read by non-component code such as `PhaseClock`. May be called
 * outside a component (for example from `main.ts` or tests); then only the module-level table is
 * updated.
 */
export function setStrings(partial: Partial<UiStrings>): void {
  current = { ...defaultUiStrings, ...partial };
  try {
    setContext(KEY, current);
  } catch {
    // Outside a component instance: the module-level table above is enough.
  }
}

/** The active table: the context value under a provider, otherwise the module-level one. */
export function getStrings(): UiStrings {
  try {
    return getContext(KEY) ?? current;
  } catch {
    return current;
  }
}

/** Text for an error that came from the server: the game's table when it names the code, else the received message. */
export function errorText(code: ErrorCode, message: string): string {
  return getStrings().clientStrings.errors?.[code] ?? message;
}
