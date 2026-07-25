import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        mode: "client",
      },
      emitCss: false,
      preprocess: [],
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["dist/**", "node_modules/**"],
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: [path.resolve("../../vitest.setup.ts")],
    transformMode: {
      web: [/\.svelte$/],
    },
  },
});
