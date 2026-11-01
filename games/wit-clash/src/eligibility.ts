import type { PlayerInfo } from "@partygame/core";
import { eligibleVoters } from "@partygame/core/kits";

/** Who may vote on a matchup: the active players who did not write one of its answers. A forfeit has no vote. */
export function eligibleVoterIds(
  activeIds: readonly string[],
  authorIds: readonly string[],
  isForfeit: boolean,
): string[] {
  if (isForfeit) return [];
  return eligibleVoters(activeIds, authorIds);
}

/** The seated players who took part in the round; a dropped connection is not a departure. */
export function seatedActiveIds(players: readonly PlayerInfo[]): string[] {
  return players.filter((p) => p.isActive && p.isReady).map((p) => p.id);
}
