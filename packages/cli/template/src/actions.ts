import { actionFactory } from "@partygame/core";
import { z } from "zod";
import { ACTION } from "./actionNames.js";
import type { __PascalName__Options } from "./options.js";
import type { __PascalName__Private } from "./private.js";
import type { __PascalName__State } from "./state.js";

export { ACTION };

/** Typed action builder: the handler's `payload` is inferred from the zod schema. */
export const defineAction = actionFactory<
  __PascalName__State,
  __PascalName__Private,
  __PascalName__Options
>();

export const NoPayloadSchema = z.object({});
