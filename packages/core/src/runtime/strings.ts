import { END_GAME, LOBBY_PHASE } from "@partygame/shared";

/**
 * Every message the core runtime owns: the lobby built-ins and the runtime's own refusals. A game
 * passes a partial table as `GameDefinition.strings`; unspecified keys keep the English default.
 * The client-visible entries (the first four) reach players in `ERROR` payloads or `state.notice`;
 * the rest are `FrameworkError` messages for server logs and the action log, where clients see the
 * fixed `CLIENT_MESSAGES` text for the code instead.
 */
export interface CoreStrings {
  /** Sent to a client whose action arrives after the runtime stopped. */
  stopped: string;
  /** Written to `state.notice` by the default failure policy. */
  failureNotice: string;
  /** `KICK_PLAYER` for the sender's own seat. */
  cannotKickSelf: string;
  /** `KICK_PLAYER` for an id that is not seated. */
  noSuchPlayer: string;
  /** `END_GAME` sent from the Lobby (server log). */
  endGameInLobby: string;
  /** `START_GAME` below `minPlayers` (server log). */
  needAtLeast(minPlayers: number): string;
  /** An action the sender's role may not send (server log). */
  notAllowedToSend(action: string): string;
  /** An action from a seat that is waiting to be let in (server log). */
  waitingToBeLetIn: string;
  /** A seated player sending an audience action (server log). */
  audienceActionFromSeat(action: string): string;
  /** An action declared only for another phase (server log). */
  notAllowedInPhase(action: string, phase: string): string;
  /** An action no phase declares (server log). */
  unknownAction(action: string): string;
}

/** The English defaults for every core-owned message. */
export const defaultCoreStrings: CoreStrings = {
  stopped: "The game has ended",
  failureNotice: "The game stopped because of an unexpected error.",
  cannotKickSelf: "You cannot kick yourself",
  noSuchPlayer: "No such player",
  endGameInLobby: `${END_GAME} is not allowed in ${LOBBY_PHASE}`,
  needAtLeast: (minPlayers) => `Need at least ${minPlayers} players to start`,
  notAllowedToSend: (action) => `Not allowed to send ${action}`,
  waitingToBeLetIn: "You are waiting to be let in",
  audienceActionFromSeat: (action) => `${action} is an audience action`,
  notAllowedInPhase: (action, phase) => `${action} is not allowed in ${phase}`,
  unknownAction: (action) => `Unknown action ${action}`,
};

/** The table a definition plays with: its `strings` over the defaults. */
export function mergeCoreStrings(partial?: Partial<CoreStrings>): CoreStrings {
  return { ...defaultCoreStrings, ...partial };
}
