import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "coverage/**"],
    coverage: {
      reportsDirectory: "../../.gemini/tmp/coverage",
      exclude: [
        "coverage/**",
        "**/coverage/**",
        "**/*.d.ts",
        "**/vitest.config.*",
        "**/src/types.ts",
        "**/src/phases/types.ts",
        "dist/**",
        "node_modules/**",
      ],
    },
  },
});
