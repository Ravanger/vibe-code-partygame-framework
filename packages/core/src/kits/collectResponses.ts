/**
 * A player's slots in a collection round: slot ids per author, keyed by playerId.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export type Slots = ReadonlyMap<string, readonly string[]>;

/**
 * One response per slot per author, keyed by playerId then slot id.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export type Responses = ReadonlyMap<string, ReadonlyMap<string, string>>;

/**
 * Every slot of every present author has a response; absent authors are not waited for, and nobody present never counts as complete.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function allResponded(
  slots: Slots,
  responses: Responses,
  presentIds: ReadonlySet<string>,
): boolean {
  const waitingOn = [...slots].filter(([playerId]) => presentIds.has(playerId));
  return (
    waitingOn.length > 0 &&
    waitingOn.every(([playerId, ids]) => ids.every((id) => responses.get(playerId)?.has(id)))
  );
}

/**
 * One entry per author of a slot; `text` is undefined when they never responded.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function entriesFor(
  slotId: string,
  slots: Slots,
  responses: Responses,
): { playerId: string; text: string | undefined }[] {
  return [...slots]
    .filter(([, ids]) => ids.includes(slotId))
    .map(([playerId]) => ({ playerId, text: responses.get(playerId)?.get(slotId) }));
}
