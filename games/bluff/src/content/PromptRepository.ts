import { readFile } from "node:fs/promises";
import { stripJsonComments } from "@partygame/content";
import { prettifyError, z } from "zod";

const PromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase kebab-case"),
  question: z.string().min(1),
  truth: z.string().min(1),
});

export type Prompt = z.infer<typeof PromptSchema>;

const PromptsFileSchema = z.object({
  prompts: z.array(PromptSchema).min(1, "prompts must not be empty"),
});

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

/**
 * Server-side only: touches node:fs. Clients receive the prompt through synced room state.
 * Reads one JSONC file shaped `{ "prompts": [...] }`; a missing file, invalid JSON, a schema
 * failure or a duplicate id throws.
 */
export async function loadPrompts(file: string): Promise<PromptRepository> {
  let text: string;
  try {
    text = await readFile(file, "utf-8");
  } catch {
    throw new Error(`Prompt file not found: ${file}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(stripJsonComments(text));
  } catch (error) {
    throw new Error(`[Prompt] Invalid JSON in ${file}: ${String(error)}`);
  }
  const parsed = PromptsFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`[Prompt] ${file} failed validation: ${prettifyError(parsed.error)}`);
  }
  const seen = new Set<string>();
  for (const prompt of parsed.data.prompts) {
    if (seen.has(prompt.id)) throw new Error(`Duplicate Prompt id "${prompt.id}" in ${file}`);
    seen.add(prompt.id);
  }
  return new PromptRepository(parsed.data.prompts);
}
