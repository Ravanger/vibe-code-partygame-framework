import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/shared/vitest.config.ts",
      "packages/core/vitest.config.ts",
      "packages/server/vitest.config.ts",
      "packages/game-client/vitest.config.ts",
      "games/wit-clash/vitest.config.ts",
    ],
  },
});
