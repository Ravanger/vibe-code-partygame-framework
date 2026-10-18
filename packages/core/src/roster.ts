import type { GameContext, PhaseState } from "./runtime/types.js";

/**
 * Seats that are active and ready, counting briefly disconnected ones: a dropped connection must not end the game.
 */
export function seatedCount(ctx: GameContext<PhaseState, unknown, unknown>): number {
  return ctx.players().filter((p) => p.isActive && p.isReady).length;
}

/**
 * True when fewer than `min` seats are active and ready.
 */
export function isBelowMinimum(
  ctx: GameContext<PhaseState, unknown, unknown>,
  min: number,
): boolean {
  return seatedCount(ctx) < min;
}

/**
 * The given ids that have no seat anymore, in input order.
 */
export function departedIds(
  ids: Iterable<string>,
  ctx: GameContext<PhaseState, unknown, unknown>,
): string[] {
  return [...ids].filter((id) => !ctx.player(id));
}
