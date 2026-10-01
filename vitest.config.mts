import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/shared/vitest.config.ts",
      "packages/core/vitest.config.ts",
      "packages/server/vitest.config.ts",
      "packages/game-client/vitest.config.ts",
      "games/wit-clash/vitest.config.ts",
      "games/wit-clash/vitest.game.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "packages/*/src/**/*.ts",
        "games/*/src/**/*.ts",
        "games/*/ui/**/*.{ts,svelte}",
        "games/*/bots/**/*.ts",
      ],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/vitest.config.*",
        "**/*.config.ts",
        "games/wit-clash/ui/main.ts",
        "packages/server/src/bun.ts",
        "games/wit-clash/server.ts",
        "games/wit-clash/bots/cli.ts",
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
