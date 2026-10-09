import { actionFactory } from "@partygame/core";
import { z } from "zod";
import { ACTION, ANSWER_MAX_LENGTH } from "./actionNames.js";
import type { WitClashOptions } from "./options.js";
import type { WitClashPrivate } from "./private.js";
import type { WitClashState } from "./state.js";

export { ACTION };

/** Typed action builder: the handler's `payload` is inferred from the zod schema. */
export const defineAction = actionFactory<WitClashState, WitClashPrivate, WitClashOptions>();

export const VoteCategorySchema = z.object({ categoryId: z.string().min(1).max(64) });
export const SubmitAnswerSchema = z.object({
  matchupId: z.string().min(1).max(64),
  answer: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
});
export const CastVoteSchema = z.object({ answerId: z.string().min(1).max(64) });
export const SetTypingSchema = z.object({ typing: z.boolean() });
export const NoPayloadSchema = z.object({});

export type SubmitAnswerPayload = z.infer<typeof SubmitAnswerSchema>;
export type CastVotePayload = z.infer<typeof CastVoteSchema>;
export type SetTypingPayload = z.infer<typeof SetTypingSchema>;
