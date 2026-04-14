import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reportsDirectory: './.gemini/tmp/coverage',
      exclude: [
        '**/coverage/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        'vitest.config.ts',
        'vitest.workspace.ts'
      ],
    },
  },
});
