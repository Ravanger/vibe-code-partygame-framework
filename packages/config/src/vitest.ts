import { svelte } from "@sveltejs/vite-plugin-svelte";
import { mergeConfig, type ViteUserConfig } from "vitest/config";

export interface TestPresetOptions {
  name: string;
  coverage: string[];
  include?: string[];
  exclude?: string[];
  setupFiles?: string[];
  overrides?: ViteUserConfig;
}

const DEFAULT_UI_SETUP = ["@testing-library/jest-dom/vitest", "@partygame/game-client/test-setup"];
const DEFAULT_NODE_SETUP = ["@partygame/config/node-test-setup"];

function shared(options: TestPresetOptions, environment: "jsdom" | "node"): ViteUserConfig {
  return {
    test: {
      name: options.name,
      environment,
      include: options.include ?? ["tests/**/*.test.ts"],
      exclude: ["dist/**", "node_modules/**", "coverage/**", ...(options.exclude ?? [])],
      fileParallelism: false,
      coverage: { include: options.coverage },
    },
  };
}

/** Vitest project config for jsdom + Svelte tests. */
export function uiTestConfig(options: TestPresetOptions): ViteUserConfig {
  return mergeConfig(
    mergeConfig(shared(options, "jsdom"), {
      plugins: [svelte({ emitCss: false })],
      resolve: { conditions: ["browser"] },
      test: { globals: true, setupFiles: options.setupFiles ?? DEFAULT_UI_SETUP },
    }),
    options.overrides ?? {},
  );
}

/** Vitest project config for node tests. */
export function nodeTestConfig(options: TestPresetOptions): ViteUserConfig {
  return mergeConfig(
    mergeConfig(shared(options, "node"), {
      test: { setupFiles: options.setupFiles ?? DEFAULT_NODE_SETUP },
    }),
    options.overrides ?? {},
  );
}
