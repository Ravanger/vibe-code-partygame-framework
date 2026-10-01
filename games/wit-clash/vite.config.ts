import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [svelte({ preprocess: [] })],
  server: { host: true, port: 5173 },
  resolve: {
    conditions: command === "serve" ? ["browser", "development"] : ["browser"],
  },
}));
