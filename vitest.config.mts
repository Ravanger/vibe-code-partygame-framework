import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/shared/vitest.config.ts",
      "packages/core/vitest.config.ts",
      "packages/server/vitest.config.ts",
      "packages/game-client/vitest.config.ts",
      "packages/bots/vitest.config.ts",
      "packages/terminal/vitest.config.ts",
      "packages/launcher/vitest.config.ts",
      "scripts/vitest.config.ts",
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
        "games/*/terminal/**/*.ts",
        "scripts/*.ts",
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
        "games/wit-clash/terminal/demo.ts",
        "games/wit-clash/terminal/play.ts",
        "packages/launcher/src/runLauncher.ts",
        "games/wit-clash/launch.ts",
        "scripts/game.ts",
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
