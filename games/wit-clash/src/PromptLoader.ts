import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";

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
  private categories: string[] = [];

  constructor(private promptPath: string) {
    this.categories = fs
      .readdirSync(promptPath)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.replace(".json", ""));
  }

  getAvailableCategories() {
    return this.categories;
  }

  static async load(filePath: string): Promise<PromptFile> {
    const raw = await readFile(filePath, "utf-8");
    // Strip comments to support JSONC
    const json = JSON.parse(raw.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ""));
    return PromptFileSchema.parse(json);
  }

  static getRandomPrompt(prompts: Prompt[]): Prompt | undefined {
    return prompts[Math.floor(Math.random() * prompts.length)];
  }
}
