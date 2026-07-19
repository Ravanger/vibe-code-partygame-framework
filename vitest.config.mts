import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
    environment: "happy-dom",
    globals: true,
    setupFiles: [path.resolve("./vitest.setup.ts")],
  },
});
