import { LOBBY_PHASE } from "@partygame/shared";
import type { Component } from "svelte";
import { PHASE, type PhaseName } from "../../src/phaseNames.js";
import type { WitClashManager } from "../manager.js";
import CategoryVote from "./CategoryVote.svelte";
import MatchupReveal from "./MatchupReveal.svelte";
import MatchupVote from "./MatchupVote.svelte";
import Prompting from "./Prompting.svelte";
import Results from "./Results.svelte";
import TieBreakerPrompting from "./TieBreakerPrompting.svelte";
import TieBreakerReveal from "./TieBreakerReveal.svelte";
import TieBreakerVote from "./TieBreakerVote.svelte";
import WaitingRoom from "./WaitingRoom.svelte";

export type KnownPhase = PhaseName | typeof LOBBY_PHASE;

export interface PhaseScreen {
  component: Component<{ manager: WitClashManager }>;
  /** What a player who joined mid-game is told is going on. */
  waitingLabel: string;
}

/** The one place to register the screen of a phase; a missing phase fails to compile. */
export const PHASE_SCREENS = {
  [LOBBY_PHASE]: { component: WaitingRoom, waitingLabel: "Waiting in the lobby" },
  [PHASE.CategorySelection]: {
    component: CategoryVote,
    waitingLabel: "Everyone is picking a category",
  },
  [PHASE.Prompting]: { component: Prompting, waitingLabel: "Everyone is writing answers" },
  [PHASE.MatchupVoting]: { component: MatchupVote, waitingLabel: "Everyone is voting" },
  [PHASE.MatchupReveal]: { component: MatchupReveal, waitingLabel: "The votes are being revealed" },
  [PHASE.TieBreakerPrompting]: {
    component: TieBreakerPrompting,
    waitingLabel: "The tied players are answering a tie-breaker",
  },
  [PHASE.TieBreakerVoting]: {
    component: TieBreakerVote,
    waitingLabel: "Everyone is voting on the tie-breaker",
  },
  [PHASE.TieBreakerReveal]: {
    component: TieBreakerReveal,
    waitingLabel: "The tie-breaker is being revealed",
  },
  [PHASE.Results]: { component: Results, waitingLabel: "The scoreboard is up" },
} satisfies Record<KnownPhase, PhaseScreen>;

export function isKnownPhase(phase: string): phase is KnownPhase {
  return Object.hasOwn(PHASE_SCREENS, phase);
}
