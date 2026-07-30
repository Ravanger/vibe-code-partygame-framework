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

      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // Must stay false: ES2022 would otherwise default it to true, and `define`
          // semantics on class fields shadow the accessors @colyseus/schema's @type
          // installs on the prototype. Change tracking then silently never runs, and the
          // encoder throws on the first collection it tries to serialize.
          useDefineForClassFields: false,
          esModuleInterop: true,
          sourceMap: true,
        },
        reportErrors: true,
      });

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
    // harness.test.ts is deliberately INCLUDED: excluding it is why a broken test harness went
    // unnoticed while seven room-level suites sat parked as .skip.ts.
    exclude: ["dist/**", "node_modules/**", "coverage/**"],
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
