import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, mergeConfig, type UserConfig } from "vite";

export interface GameViteOptions {
  port?: number;
  overrides?: UserConfig;
}

/** Vite config for a game client: Svelte, LAN-reachable dev server, `development` condition only for serve. */
export function defineGameViteConfig(options: GameViteOptions = {}) {
  return defineConfig(({ command }) =>
    mergeConfig(
      {
        plugins: [svelte({ preprocess: [] })],
        server: { host: true, port: options.port ?? 5173 },
        resolve: {
          conditions: command === "serve" ? ["browser", "development"] : ["browser"],
        },
      },
      options.overrides ?? {},
    ),
  );
}
