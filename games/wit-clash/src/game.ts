import { createHash } from "node:crypto";
import { createTextFilter } from "@partygame/content/filter";
import { defineGame, textFilterMiddleware } from "@partygame/core";
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
  /** The repo-shipped canon daily mode plays from; `categories` when omitted. */
  canon?: CategoryRepository;
}

export function createWitClashGame({ categories, canon = categories }: WitClashConfig) {
  if (categories.all().length === 0) throw new Error("WitClash needs at least one category");
  return defineGame<WitClashState, WitClashPrivate, WitClashOptions>({
    name: "WitClash",
    version: "1",
    contentHash: () =>
      createHash("sha256")
        .update(
          categories
            .all()
            .map((category) => JSON.stringify(category))
            .sort()
            .join("\n"),
        )
        .digest("hex"),
    minPlayers: META.minPlayers,
    maxPlayers: META.maxPlayers,
    startPhase: PHASE.CategorySelection,
    options: WitClashOptionsSchema,
    filterLevel: (options) => options.filterLevel,
    middleware: [
      textFilterMiddleware(createTextFilter(), {
        onRejected: (ctx) => {
          const state = ctx.state as WitClashState;
          ++state.rejectedTexts;
        },
      }),
    ],
    createPrivateState: () => new WitClashPrivate(categories, canon),
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
