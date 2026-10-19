import { actionFactory } from "@partygame/core";
import { z } from "zod";
import { ACTION, ANSWER_MAX_LENGTH } from "./actionNames.js";
import type { BluffOptions } from "./options.js";
import type { BluffPrivate } from "./private.js";
import type { BluffState } from "./state.js";

export { ACTION };

/** Typed action builder: the handler's `payload` is inferred from the zod schema. */
export const defineAction = actionFactory<BluffState, BluffPrivate, BluffOptions>();

export const NoPayloadSchema = z.object({});
export const SubmitFakeSchema = z.object({
  text: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
});
export const CastVoteSchema = z.object({ optionId: z.string().min(1).max(64) });
