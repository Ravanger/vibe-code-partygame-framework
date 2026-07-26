import path from "node:path";
import type { Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

function svelteTsPlugin(): Plugin {
  return {
    name: "svelte-ts-runes",
    enforce: "pre",
    async transform(code: string, id: string) {
      if (!id.endsWith(".svelte.ts")) return null;
      try {
        const { compileModule } = await import("svelte/compiler");
        const ts = await import("typescript");
        // Strip TypeScript syntax first (import type, types, etc.)
        const transpiled = ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            verbatimModuleSyntax: false,
          },
        });
        const result = compileModule(transpiled.outputText, {
          filename: id,
          generate: "client",
          dev: true,
        });
        return {
          code: result.js.code,
          map: result.js.map,
        };
      } catch (e: any) {
        console.error("[svelte-ts-runes] Failed to compile", id, e.message);
        throw e;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    svelteTsPlugin(),
    svelte({
      compilerOptions: {
        mode: "client",
      },
      emitCss: false,
      preprocess: [],
      experimental: {
        compileModule: {
          exclude: [/\.svelte\.ts$/],
        },
      },
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["dist/**", "node_modules/**"],
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: [path.resolve("../../vitest.setup.ts")],
  },
});


