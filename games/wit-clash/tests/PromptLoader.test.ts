import { describe, it, expect } from 'vitest';
import { PromptLoader } from '../src/PromptLoader.js';
import { writeFile, unlink } from 'fs/promises';

describe('PromptLoader', () => {
  it('should fail if file is missing', async () => {
    await expect(PromptLoader.load('nonexistent.jsonc')).rejects.toThrow();
  });

  it('should fail if JSONC content is malformed', async () => {
    const path = 'invalid.jsonc';
    await writeFile(path, '{ "version": "1.0", "bad": "data" }');
    await expect(PromptLoader.load(path)).rejects.toThrow();
    await unlink(path);
  });

  it('should pass if JSONC is valid', async () => {
    const path = 'valid.jsonc';
    const data = { version: "1.0", prompts: [{ id: "p1", text: "hi" }], tieBreakers: [] };
    await writeFile(path, JSON.stringify(data));
    const result = await PromptLoader.load(path);
    expect(result.version).toBe("1.0");
    await unlink(path);
  });
});
