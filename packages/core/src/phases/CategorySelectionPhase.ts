export class CategorySelectionPhase {
  getRandomCategories(
    categories: string[],
    count: number,
    rng: () => number = Math.random,
  ): string[] {
    const a = [...categories];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      // biome-ignore lint/style/noNonNullAssertion: Array bounds guaranteed by loop condition
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a.slice(0, Math.min(count, a.length));
  }
}
