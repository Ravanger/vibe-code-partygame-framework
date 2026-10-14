import { defineGame } from "@partygame/core";
import type { CategoryRepository } from "./content/CategoryRepository.js";
import { META } from "./meta.js";
import { type WitClashOptions, WitClashOptionsSchema } from "./options.js";
import { PHASE } from "./phaseNames.js";
import { CategorySelection } from "./phases/CategorySelection.js";
import { MatchupReveal } from "./phases/MatchupReveal.js";
import { MatchupVoting } from "./phases/MatchupVoting.js";
import { Prompting } from "./phases/Prompting.js";
import { Results } from "./phases/Results.js";
import { TieBreakerPrompting } from "./phases/TieBreakerPrompting.js";
import { TieBreakerReveal } from "./phases/TieBreakerReveal.js";
import { TieBreakerVoting } from "./phases/TieBreakerVoting.js";
import { WitClashPrivate } from "./private.js";
import { Round } from "./round.js";
import type { WitClashState } from "./state.js";

export interface WitClashConfig {
  categories: CategoryRepository;
}

export function createWitClashGame({ categories }: WitClashConfig) {
  if (categories.all().length === 0) throw new Error("WitClash needs at least one category");
  return defineGame<WitClashState, WitClashPrivate, WitClashOptions>({
    name: "WitClash",
    version: "1",
    minPlayers: META.minPlayers,
    maxPlayers: META.maxPlayers,
    startPhase: PHASE.CategorySelection,
    options: WitClashOptionsSchema,
    createPrivateState: () => new WitClashPrivate(categories),
    phases: {
      [PHASE.CategorySelection]: CategorySelection,
      [PHASE.Prompting]: Prompting,
      [PHASE.MatchupVoting]: MatchupVoting,
      [PHASE.MatchupReveal]: MatchupReveal,
      [PHASE.TieBreakerPrompting]: TieBreakerPrompting,
      [PHASE.TieBreakerVoting]: TieBreakerVoting,
      [PHASE.TieBreakerReveal]: TieBreakerReveal,
      [PHASE.Results]: Results,
    },
    onEndGame: (ctx) => {
      ctx.state.notice = "The host ended the game.";
    },
    onReturnToLobby: (ctx) => new Round(ctx).clearGame(),
  });
}
