import { actionFactory } from "@partygame/core";
import { z } from "zod";
import { ACTION } from "./actionNames.js";
import type { RushOptions } from "./options.js";
import type { RushPrivate } from "./private.js";
import type { RushState } from "./state.js";

export { ACTION };

/** Typed action builder: the handler's `payload` is inferred from the zod schema. */
export const defineAction = actionFactory<RushState, RushPrivate, RushOptions>();

export const NoPayloadSchema = z.object({});
