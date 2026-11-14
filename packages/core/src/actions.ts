import { z } from "zod";
import type { ActionDefinition, PhaseState } from "./runtime/types.js";

/** The payload schema for an action that takes no fields; extra wire keys (including `type`) are stripped, as with `z.object({})`. */
export const EmptyPayloadSchema = z.object({});

/** The host-only action that ends the game and returns the room to the lobby; a game puts it in its own end phase under its own action name. */
export function playAgainAction(): ActionDefinition<PhaseState, unknown, unknown, unknown> {
  return {
    from: "host",
    payload: EmptyPayloadSchema,
    handler: (ctx) => ctx.returnToLobby(),
  };
}
