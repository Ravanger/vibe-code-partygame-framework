import type { BaseGameState } from "@partygame/shared/schema";
import { waitUntil } from "./waitUntil.js";

/**
 * Waits until a client's decoded copy of the room state holds exactly one entry in the `.view()`
 * map returned by `pick(state)`, and that entry is keyed by `playerId`; resolves with the entry's
 * value. A view that shows another seat's key, or a second entry, keeps polling until the timeout,
 * so an isolation violation fails the test with `label`. The decoded map may be undefined until the
 * first view patch lands; that also keeps polling.
 */
export async function waitForOwnEntry<TState extends BaseGameState, TValue>(
  state: TState,
  playerId: string,
  pick: (state: TState) => Map<string, TValue> | undefined,
  label = "own view entry",
): Promise<TValue> {
  let own: TValue | undefined;
  await waitUntil(() => {
    const map = pick(state);
    if (map === undefined || map.size !== 1) return false;
    own = map.get(playerId);
    return own !== undefined;
  }, label);
  // The wait only resolves once the predicate stored a real entry in `own`, so it holds one here.
  return own as TValue;
}
