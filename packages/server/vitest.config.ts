import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@partygame/server",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "coverage/**"],
    fileParallelism: false,
    coverage: {
      include: ["src/**/*.ts"],
    },
    deps: {
      interopDefault: true,
    },
  },
});
