import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    conditions: ["browser"],
  },
  plugins: [svelte({ emitCss: false })],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "tests/game/**", "tests/bots/**"],
    setupFiles: ["../../vitest.setup.ts", "./tests/setup.ts"],
    coverage: {
      include: ["src/**/*.ts", "ui/**/*.ts"],
    },
  },
});
