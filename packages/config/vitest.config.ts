import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@partygame/config",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: { include: ["src/**/*.ts"] },
  },
});
