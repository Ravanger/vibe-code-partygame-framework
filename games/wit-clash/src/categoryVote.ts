import { required } from "@partygame/core";
import { leaders } from "@partygame/core/kits";

export interface TalliedOption {
  id: string;
  votes: number;
}

/** Plurality winner; joint leaders (including "nobody voted") are broken at random. */
export function resolveCategoryVote(
  options: readonly TalliedOption[],
  random: () => number,
): string {
  if (options.length === 0) {
    throw new Error("Cannot resolve category vote: no options provided");
  }
  const { ids } = leaders(new Map(options.map((o): [string, number] => [o.id, o.votes])));
  return required(ids[Math.floor(random() * ids.length)], "category leader");
}
