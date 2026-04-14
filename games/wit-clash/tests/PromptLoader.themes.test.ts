import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptLoader } from '../src/PromptLoader';
import fs from 'node:fs';

vi.mock('node:fs');

describe('PromptLoader Themes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should discover all json files in prompts directory as categories', () => {
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['pop.json', 'niche.json'] as any);
    const loader = new PromptLoader('mock/path');
    expect(loader.getAvailableCategories()).toEqual(['pop', 'niche']);
  });
});
