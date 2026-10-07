import type { GameContext, PhaseDefinition } from "@partygame/core";
import type { __PascalName__Options } from "./options.js";
import type { __PascalName__State } from "./state.js";

export type __PascalName__Context = GameContext<
  __PascalName__State,
  __PascalName__Private,
  __PascalName__Options
>;
export type __PascalName__Phase = PhaseDefinition<
  __PascalName__State,
  __PascalName__Private,
  __PascalName__Options
>;

/** Server-only state. The wave game keeps everything in the synced state; add fields here as needed. */
export class __PascalName__Private {}
