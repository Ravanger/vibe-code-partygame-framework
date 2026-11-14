/** The shared "Round 2 of 3" label for a room's current round over its total rounds. */
export function roundLabel(round: number, total: number): string {
  return `Round ${round} of ${total}`;
}
