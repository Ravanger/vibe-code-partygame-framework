import { loadJsoncDir } from "@partygame/content";
import { z } from "zod";

const PromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  question: z.string().min(1),
  truth: z.string().min(1),
});

export type Prompt = z.infer<typeof PromptSchema>;

/** The prompts a game draws from; ids are unique across all files. */
export class PromptRepository {
  constructor(private readonly prompts: Prompt[]) {}

  all(): Prompt[] {
    return [...this.prompts];
  }

  byId(id: string): Prompt | undefined {
    return this.prompts.find((p) => p.id === id);
  }
}

export function promptsFromArray(prompts: Prompt[]): PromptRepository {
  return new PromptRepository(prompts);
}

/** Server-side only: touches node:fs. Clients receive the prompt through synced room state. */
export async function loadPromptsFromDir(dir: string): Promise<PromptRepository> {
  return new PromptRepository(
    await loadJsoncDir(dir, PromptSchema, { idOf: (p) => p.id, label: "Prompt" }),
  );
}
