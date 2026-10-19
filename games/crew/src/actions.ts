import { actionFactory } from "@partygame/core";
import { z } from "zod";
import { ACTION, GUESS_MAX, GUESS_MIN } from "./actionNames.js";
import type { CrewOptions } from "./options.js";
import type { CrewPrivate } from "./private.js";
import type { CrewState } from "./state.js";

export { ACTION };

/** Typed action builder: the handler's `payload` is inferred from the zod schema. */
export const defineAction = actionFactory<CrewState, CrewPrivate, CrewOptions>();

export const NoPayloadSchema = z.object({});
export const GuessSchema = z.object({ value: z.number().int().min(GUESS_MIN).max(GUESS_MAX) });
