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
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      all: true,
      include: ["packages/*/src/**/*.ts", "games/*/src/**/*.ts", "games/*/ui/**/*.{ts,svelte}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/vitest.config.*",
        "**/*.config.ts",
        "vitest.workspace.ts",
        "**/*.svelte",
        "**/src/types.ts",
        "**/src/phases/types.ts",
        "packages/server/src/index.ts",
        "packages/server/src/database/**",
        "games/wit-clash/ui/main.ts",
        // Integration-only: @colyseus/schema decorators prevent unit testing under Vitest (Node).
        "packages/server/src/rooms/GameRoom.ts",
        "packages/server/src/schema/**/*.ts",
        "packages/server/src/createGameServer.ts",
        // Coverage attribution broken: Svelte runes transform interferes with v8 source maps.
        "games/wit-clash/src/content/CategoryRepository.ts",
        "games/wit-clash/src/content/stripJsonComments.ts",
      ],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
