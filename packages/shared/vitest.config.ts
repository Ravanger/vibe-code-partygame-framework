import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reportsDirectory: '../../.gemini/tmp/coverage',
      exclude: ['coverage/**', '**/coverage/**'],
    },
  },
});
