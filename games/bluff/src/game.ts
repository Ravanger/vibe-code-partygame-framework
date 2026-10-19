import { defineGame } from "@partygame/core";
import type { PromptRepository } from "./content/PromptRepository.js";
import { META } from "./meta.js";
import { type BluffOptions, BluffOptionsSchema } from "./options.js";
import { PHASE } from "./phaseNames.js";
import { Results } from "./phases/Results.js";
import { Reveal } from "./phases/Reveal.js";
import { Voting } from "./phases/Voting.js";
import { Writing } from "./phases/Writing.js";
import { BluffPrivate } from "./private.js";
import { Round } from "./round.js";
import type { BluffState } from "./state.js";

export interface BluffConfig {
  prompts: PromptRepository;
}

export function createBluffGame({ prompts }: BluffConfig) {
  if (prompts.all().length === 0) throw new Error("Bluff needs at least one prompt");
  return defineGame<BluffState, BluffPrivate, BluffOptions>({
    name: "Bluff",
    version: "1",
    minPlayers: META.minPlayers,
    maxPlayers: META.maxPlayers,
    startPhase: PHASE.Writing,
    options: BluffOptionsSchema,
    createPrivateState: () => new BluffPrivate(prompts),
    phases: {
      [PHASE.Writing]: Writing,
      [PHASE.Voting]: Voting,
      [PHASE.Reveal]: Reveal,
      [PHASE.Results]: Results,
    },
    onReturnToLobby: (ctx) => new Round(ctx).clearGame(),
  });
}
