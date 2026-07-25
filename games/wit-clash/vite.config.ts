import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte({
      emitCss: false,
      preprocess: [],
    }),
  ],
  server: { host: true, port: 5173 },
  resolve: {
    conditions: ["browser", "development"],
  },
});
