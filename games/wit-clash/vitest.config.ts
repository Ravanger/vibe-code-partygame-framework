import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "!**/App.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
