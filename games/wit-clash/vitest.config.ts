import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

console.log("[vitest.config] Loading svelte-ts-runes plugin");

function svelteTsPlugin(): Plugin {
  return {
    name: "svelte-ts-runes",
    enforce: "pre",
    async transform(code: string, id: string) {
      console.log("[svelte-ts-runes] transform called for:", id);
      if (!id.endsWith(".svelte.ts")) return null;
      console.log("[svelte-ts-runes] processing .svelte.ts file:", id);
      try {
        const { compileModule } = await import("svelte/compiler");
        const ts = await import("typescript");
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
    exclude: ["dist/**", "node_modules/**", "tests/screens/**/*.test.ts"],
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: [path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../vitest.setup.ts")],
  },
});
