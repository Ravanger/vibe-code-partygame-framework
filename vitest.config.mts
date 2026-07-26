import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: false,
  test: {
    projects: [
      "packages/shared/vitest.config.ts",
      "packages/core/vitest.config.ts",
      "packages/server/vitest.config.ts",
      "packages/game-client/vitest.config.ts",
      "games/wit-clash/vitest.config.ts",
    ],
    coverage: {
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
      reportsDirectory: "./.gemini/tmp/coverage",
    },
  },
});
