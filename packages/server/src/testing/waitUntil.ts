import { waitFor } from "@partygame/client-utils";

/** Poll until `predicate` holds. A patch tick is not a barrier; wait on the condition you care about. */
export function waitUntil(
  predicate: () => boolean,
  label = "condition",
  timeoutMs = 4000,
  stepMs = 10,
): Promise<void> {
  return waitFor(predicate, label, timeoutMs, stepMs);
}
