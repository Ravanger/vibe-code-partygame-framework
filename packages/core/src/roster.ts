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

/**
 * The remembered names and participants of the current game. Keep one in a game's private state
 * (it is server-only bookkeeping, never synced); pass the context to each call. A leaver keeps
 * their name and place until dropped or cleared.
 */
export class RosterLedger {
  private names: Record<string, string> = {};
  private participants = new Set<string>();

  /** Remembers every seat's name and adds the active, ready players to the participants. */
  remember(ctx: GameContext<PhaseState, unknown, unknown>): void {
    for (const player of ctx.players()) {
      if (player.name) this.names[player.id] = player.name;
      if (player.isActive && player.isReady) this.participants.add(player.id);
    }
  }

  /** The seat's current name, else the last remembered one, else "". */
  nameOf(ctx: GameContext<PhaseState, unknown, unknown>, playerId: string): string {
    return ctx.player(playerId)?.name ?? this.names[playerId] ?? "";
  }

  /** Everyone added by {@link RosterLedger.remember}, in that order. */
  get participantIds(): readonly string[] {
    return [...this.participants];
  }

  /** The last seen name of every remembered player, including leavers. */
  get rememberedNames(): Readonly<Record<string, string>> {
    return this.names;
  }

  /** Forgets the player's name and removes them from the participants. */
  drop(playerId: string): void {
    delete this.names[playerId];
    this.participants.delete(playerId);
  }

  /** Forgets every name and participant, for a fresh game. */
  clear(): void {
    this.names = {};
    this.participants.clear();
  }
}

/**
 * True when fewer than `min` seats are active and ready; in that case sets `state.notice` to
 * `notice` and queues the return to the lobby, which the runtime applies when the current
 * dispatch drains.
 */
export function endIfBelowMinimum(
  ctx: GameContext<PhaseState, unknown, unknown>,
  min: number,
  notice: string,
): boolean {
  if (!isBelowMinimum(ctx, min)) return false;
  ctx.state.notice = notice;
  ctx.returnToLobby();
  return true;
}

/**
 * The player's entry in a synced per-player map, creating it and revealing it to them when
 * missing.
 */
export function ensureMine<T extends object>(
  ctx: GameContext<PhaseState, unknown, unknown>,
  mine: Map<string, T>,
  playerId: string,
  create: () => T,
): T {
  const existing = mine.get(playerId);
  if (existing) return existing;
  const created = create();
  mine.set(playerId, created);
  ctx.showTo(playerId, created);
  return created;
}

/** Hides every entry from its owner and empties the map. */
export function resetMine<T extends object>(
  ctx: GameContext<PhaseState, unknown, unknown>,
  mine: Map<string, T>,
): void {
  for (const [playerId, entry] of [...mine]) ctx.hideFrom(playerId, entry);
  mine.clear();
}

/**
 * Hides and removes the entries whose ids have no seat anymore — a dropped connection is not a
 * departure. Returns those ids, unique, in input order.
 */
export function pruneMine<T extends object>(
  ctx: GameContext<PhaseState, unknown, unknown>,
  mine: Map<string, T>,
  ids: Iterable<string>,
): string[] {
  const departed = [...new Set(departedIds(ids, ctx))];
  for (const playerId of departed) {
    const entry = mine.get(playerId);
    if (entry === undefined) continue;
    ctx.hideFrom(playerId, entry);
    mine.delete(playerId);
  }
  return departed;
}
