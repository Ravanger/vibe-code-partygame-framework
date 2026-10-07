import { LOBBY_PHASE } from "@partygame/shared";
import type { Component } from "svelte";
import { PHASE, type PhaseName } from "../../src/phaseNames.js";
import type { __PascalName__Manager } from "../manager.js";
import Lobby from "./Lobby.svelte";
import Results from "./Results.svelte";
import Waving from "./Waving.svelte";

export type KnownPhase = PhaseName | typeof LOBBY_PHASE;

export interface PhaseScreen {
  component: Component<{ manager: __PascalName__Manager }>;
  /** What a player who joined mid-game is told is going on. */
  waitingLabel: string;
  /** Shown for a moment when the room enters the phase; empty for none. */
  banner: string;
}

/** The one place to register every screen: a missing phase is a compile error. */
export const PHASE_SCREENS = {
  [LOBBY_PHASE]: { component: Lobby, waitingLabel: "Waiting in the lobby", banner: "" },
  [PHASE.Waving]: { component: Waving, waitingLabel: "Everyone is waving", banner: "WAVE!" },
  [PHASE.Results]: { component: Results, waitingLabel: "The results are in", banner: "IT'S OVER!" },
} satisfies Record<KnownPhase, PhaseScreen>;

/** True for phases this client knows a screen for. */
export const isKnownPhase = (phase: string): phase is KnownPhase =>
  Object.hasOwn(PHASE_SCREENS, phase);
