import { type ClientStrings, defaultClientStrings } from "@partygame/game-client";
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
  /** `aria-label` of the QrCode image. */
  qrCode: string;
  /** Builds the Timer announcement for a given number of seconds left. */
  secondsRemaining: (seconds: number) => string;
  /**
   * The client-side table from `@partygame/game-client`; pass the same table to the manager's
   * `strings` option so one table covers both layers.
   */
  clientStrings?: Partial<ClientStrings>;
}

/** The English defaults for every game-ui label; `clientStrings` mirrors {@link defaultClientStrings}. */
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
  qrCode: "QR code that opens the join link",
  secondsRemaining: (seconds) => `${seconds} seconds remaining`,
  clientStrings: defaultClientStrings,
};

let current: UiStrings = defaultUiStrings;
/** Only the error codes a game actually replaced; everything else keeps its received message. */
let clientErrorText: Partial<Record<ErrorCode, string>> = {};

/**
 * Registers a partial table at the app root (Svelte context for the component tree) and in the
 * module-level table read by non-component code such as `PhaseClock`. May be called outside a
 * component (tests); then only the module-level table is updated.
 */
export function setStrings(partial: Partial<UiStrings>): void {
  current = { ...defaultUiStrings, ...partial };
  clientErrorText = partial.clientStrings?.errors ?? {};
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
  return clientErrorText[code] ?? message;
}
