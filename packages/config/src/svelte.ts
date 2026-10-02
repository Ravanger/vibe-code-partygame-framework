import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** Svelte compiler config for a game: runes mode and Vite preprocessing. */
export const svelteConfig = {
  preprocess: [vitePreprocess()],
  compilerOptions: { runes: true },
};
