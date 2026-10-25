import { Metadata } from "@colyseus/schema";
import { BaseGameState } from "./BaseGameState.js";

/** The fields `BaseGameState` itself declares; the framework allow-lists them for every game. */
const BASE_FIELDS: ReadonlySet<string> = new Set(Object.keys(Metadata.getFields(BaseGameState)));

/**
 * Fail loudly when a synced state class would broadcast a field to every client: every field of
 * `stateClass` (own and inherited) must be either listed in `allow`, tagged `.view()`, or declared
 * by `BaseGameState`. Nested schema classes are not checked — they inherit their holding field's
 * visibility. Throws naming the class and every offending field.
 */
export function assertSyncedFields(
  stateClass: new () => BaseGameState,
  allow: readonly string[],
): void {
  const metadata = Metadata.initialize(stateClass);
  const listed = new Set(allow);
  const leaking = Object.keys(Metadata.getFields(stateClass)).filter((name) => {
    const index = metadata[name];
    return (
      index !== undefined &&
      !listed.has(name) &&
      !BASE_FIELDS.has(name) &&
      !Metadata.hasViewTagAtIndex(metadata, index)
    );
  });
  if (leaking.length > 0) {
    throw new Error(
      `${stateClass.name} syncs fields that are neither in publicFields nor tagged .view(): ${leaking.join(", ")}. ` +
        "List them in the hosted game's publicFields or tag them .view() so they reach only their owner.",
    );
  }
}
