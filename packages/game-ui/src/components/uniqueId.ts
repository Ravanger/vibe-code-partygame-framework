let seq = 0;

/** A document-unique id for a mounted component instance, e.g. `playerName-3`. */
export function nextId(prefix: string): string {
  return `${prefix}-${++seq}`;
}
