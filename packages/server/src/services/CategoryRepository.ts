export interface Category {
  id: string;
  name: string;
  emoji: string;
  tieBreakers: string[];
  prompts: Array<{ id: string; text: string }>;
}

export class CategoryRepository {
  private categories: Category[];

  private constructor(categories: Category[]) {
    this.categories = categories;
  }

  static fromArray(categories: Category[]): CategoryRepository {
    return new CategoryRepository(categories);
  }

  getAll(): Category[] {
    return this.categories;
  }

  getById(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }
}
