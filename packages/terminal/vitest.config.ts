import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@partygame/terminal",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    fileParallelism: false,
    coverage: { include: ["src/**/*.ts"] },
  },
});
