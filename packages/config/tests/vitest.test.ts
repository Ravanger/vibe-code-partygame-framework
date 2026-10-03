import { describe, expect, it } from "vitest";
import { nodeTestConfig, uiTestConfig } from "../src/vitest.js";

function pluginNames(plugins: readonly unknown[] | undefined): string[] {
  return (plugins ?? []).flatMap((p) => {
    if (Array.isArray(p)) return pluginNames(p);
    if (typeof p === "object" && p !== null && "name" in p && typeof p.name === "string")
      return [p.name];
    return [];
  });
}

const base = { name: "demo", coverage: ["src/**/*.ts"] };

describe("uiTestConfig", () => {
  it("sets up jsdom with svelte", () => {
    const config = uiTestConfig(base);
    expect(pluginNames(config.plugins)).toContain("vite-plugin-svelte");
    expect(config.resolve?.conditions).toEqual(["browser"]);
    expect(config.test?.name).toBe("demo");
    expect(config.test?.environment).toBe("jsdom");
    expect(config.test?.globals).toBe(true);
    expect(config.test?.fileParallelism).toBe(false);
  });

  it("defaults include, exclude, coverage and setupFiles", () => {
    const config = uiTestConfig(base);
    expect(config.test?.include).toEqual(["tests/**/*.test.ts"]);
    expect(config.test?.exclude).toEqual(["dist/**", "node_modules/**", "coverage/**"]);
    expect(config.test?.coverage?.include).toEqual(["src/**/*.ts"]);
    expect(config.test?.setupFiles).toEqual([
      "@testing-library/jest-dom/vitest",
      "@partygame/game-client/test-setup",
    ]);
  });

  it("takes include, extra excludes and replaces setupFiles", () => {
    const config = uiTestConfig({
      ...base,
      include: ["a/**/*.test.ts"],
      exclude: ["tests/game/**"],
      setupFiles: ["./setup.ts"],
    });
    expect(config.test?.include).toEqual(["a/**/*.test.ts"]);
    expect(config.test?.exclude).toEqual([
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "tests/game/**",
    ]);
    expect(config.test?.setupFiles).toEqual(["./setup.ts"]);
  });

  it("merges overrides last", () => {
    const config = uiTestConfig({
      ...base,
      overrides: { test: { fileParallelism: true, testTimeout: 1 } },
    });
    expect(config.test?.fileParallelism).toBe(true);
    expect(config.test?.testTimeout).toBe(1);
    expect(config.test?.environment).toBe("jsdom");
  });
});

describe("nodeTestConfig", () => {
  it("sets up the node environment without plugins", () => {
    const config = nodeTestConfig(base);
    expect(config.plugins).toBeUndefined();
    expect(config.test?.name).toBe("demo");
    expect(config.test?.environment).toBe("node");
    expect(config.test?.fileParallelism).toBe(false);
    expect(config.test?.include).toEqual(["tests/**/*.test.ts"]);
    expect(config.test?.exclude).toEqual(["dist/**", "node_modules/**", "coverage/**"]);
    expect(config.test?.coverage?.include).toEqual(["src/**/*.ts"]);
  });

  it("defaults setupFiles to the node WebSocket polyfill, replaced when given", () => {
    expect(nodeTestConfig(base).test?.setupFiles).toEqual(["@partygame/config/node-test-setup"]);
    expect(nodeTestConfig({ ...base, setupFiles: ["./s.ts"] }).test?.setupFiles).toEqual([
      "./s.ts",
    ]);
  });

  it("takes include and extra excludes", () => {
    const config = nodeTestConfig({ ...base, include: ["x/**"], exclude: ["y/**"] });
    expect(config.test?.include).toEqual(["x/**"]);
    expect(config.test?.exclude).toEqual(["dist/**", "node_modules/**", "coverage/**", "y/**"]);
  });

  it("merges overrides last", () => {
    const config = nodeTestConfig({
      ...base,
      overrides: { test: { fileParallelism: true, server: { deps: { inline: ["z"] } } } },
    });
    expect(config.test?.fileParallelism).toBe(true);
    expect(config.test?.server?.deps?.inline).toEqual(["z"]);
    expect(config.test?.environment).toBe("node");
  });
});
