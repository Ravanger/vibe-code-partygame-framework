import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import * as ts from "typescript";

function tsTransformPlugin(): Plugin {
  return {
    name: "ts-transform",
    enforce: "pre",
    transform(code, id) {
      // Only transform TypeScript files (not .d.ts), including @colyseus/schema source files
      if (!id.endsWith(".ts") || id.endsWith(".d.ts")) return null;

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
        },
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
    deps: {
      interopDefault: true,
    },
    coverage: {
      reportsDirectory: "../../.gemini/tmp/coverage",
      exclude: [
        "coverage/**",
        "**/coverage/**",
        "**/*.d.ts",
        "**/vitest.config.*",
        "**/src/types.ts",
        "**/src/phases/types.ts",
        "dist/**",
        "node_modules/**",
      ],
    },
  },
});
