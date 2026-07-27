import * as ts from "typescript";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

function tsTransformPlugin(): Plugin {
  return {
    name: "ts-transform",
    enforce: "pre",
    transform(code, id) {
      // Only transform TypeScript files (not .d.ts), including @colyseus/schema source files
      // Scope to server package and node_modules to avoid breaking source maps for other projects
      if (!id.endsWith(".ts") || id.endsWith(".d.ts")) return null;
      if (
        !id.includes("packages/server") &&
        !id.includes("packages/core") &&
        !id.includes("games/wit-clash") &&
        !id.includes("node_modules")
      )
        return null;
      // Let Vite handle content files natively for proper source maps
      if (id.includes("/src/content/")) return null;

      console.log("[ts-transform] Transforming:", id);

      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          sourceMap: true,
        },
        reportErrors: true,
      });

      console.log("[ts-transform] Full output for", id.split("/").pop(), ":");
      console.log(result.outputText.slice(0, 200));

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
        moduleSideEffects: false,
      };
    },
  };
}

export default defineConfig({
  plugins: [tsTransformPlugin()],
  oxc: false,
  optimizeDeps: {
    exclude: ["@colyseus/schema"],
  },
  test: {
    name: "@partygame/server",
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "coverage/**", "**/helpers/harness.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
    coverage: {
      include: ["src/**/*.ts"],
    },
    deps: {
      interopDefault: true,
    },
  },
});
