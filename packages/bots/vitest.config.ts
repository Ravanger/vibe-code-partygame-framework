import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@partygame/bots",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    fileParallelism: false,
    coverage: { include: ["src/**/*.ts"] },
  },
});
