import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "wit-clash-game",
    environment: "node",
    include: ["tests/game/**/*.test.ts", "tests/bots/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    fileParallelism: false,
    coverage: { include: ["src/**/*.ts", "bots/**/*.ts"] },
  },
});
