import { z } from 'zod';
import { readFile } from 'fs/promises';

export const PromptSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const PromptFileSchema = z.object({
  version: z.string(),
  prompts: z.array(PromptSchema),
  tieBreakers: z.array(PromptSchema),
});

export type Prompt = z.infer<typeof PromptSchema>;
export type PromptFile = z.infer<typeof PromptFileSchema>;

export class PromptLoader {
  static async load(filePath: string): Promise<PromptFile> {
    const raw = await readFile(filePath, 'utf-8');
    // Strip comments to support JSONC
    const json = JSON.parse(raw.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''));
    return PromptFileSchema.parse(json);
  }

  static getRandomPrompt(prompts: Prompt[]): Prompt {
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
}
