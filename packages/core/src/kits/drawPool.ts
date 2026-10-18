/**
 * Draws without replacement against `usedIds`: the unused items when there are at least `needed` of them, otherwise all items, whose ids it removes from `usedIds` (a fresh start). The caller marks drawn ids used after assigning them.
 *
 * @experimental Phase kit API; may change before 1.0.
 */
export function drawPool<T extends { id: string }>(
  items: readonly T[],
  usedIds: Set<string>,
  needed: number,
): { items: readonly T[]; exhausted: boolean } {
  const fresh = items.filter((item) => !usedIds.has(item.id));
  if (fresh.length >= needed) return { items: fresh, exhausted: false };
  for (const item of items) usedIds.delete(item.id);
  return { items, exhausted: true };
}
