/** The singular or plural form of a count: `one` for 1, `other` (default `${one}s`) otherwise. */
export function plural(count: number, one: string, other?: string): string {
  return count === 1 ? one : (other ?? `${one}s`);
}
