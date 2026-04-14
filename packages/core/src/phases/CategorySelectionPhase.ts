export class CategorySelectionPhase {
  getRandomCategories(categories: string[], count: number): string[] {
    return [...categories].sort(() => 0.5 - Math.random()).slice(0, count);
  }
}
