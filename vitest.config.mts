import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reportsDirectory: "./.gemini/tmp/coverage",
      exclude: [
        "**/coverage/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/vitest.config.*",
        "**/src/types.ts",
        "**/src/phases/types.ts",
        "vitest.workspace.ts",
        "packages/server/src/index.ts",
      ],
    },
  },
});
