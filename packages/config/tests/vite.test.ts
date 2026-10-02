import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { defineGameViteConfig } from "../src/vite.js";

const serve: ConfigEnv = { command: "serve", mode: "development" };
const build: ConfigEnv = { command: "build", mode: "production" };

function resolveConfig(
  factory: ReturnType<typeof defineGameViteConfig>,
  env: ConfigEnv,
): UserConfig {
  if (typeof factory !== "function") throw new Error("expected a config function");
  const result = factory(env);
  if (result instanceof Promise) throw new Error("expected a synchronous config");
  return result;
}

function pluginNames(plugins: readonly unknown[] | undefined): string[] {
  return (plugins ?? []).flatMap((p) => {
    if (Array.isArray(p)) return pluginNames(p);
    if (typeof p === "object" && p !== null && "name" in p && typeof p.name === "string")
      return [p.name];
    return [];
  });
}

describe("defineGameViteConfig", () => {
  it("adds the svelte plugin", () => {
    const config = resolveConfig(defineGameViteConfig(), build);
    expect(pluginNames(config.plugins)).toContain("vite-plugin-svelte");
  });

  it("serves on all hosts at port 5173 by default", () => {
    const config = resolveConfig(defineGameViteConfig(), build);
    expect(config.server).toMatchObject({ host: true, port: 5173 });
  });

  it("takes the port option", () => {
    const config = resolveConfig(defineGameViteConfig({ port: 4000 }), build);
    expect(config.server?.port).toBe(4000);
  });

  it("adds the development condition only for serve", () => {
    expect(resolveConfig(defineGameViteConfig(), serve).resolve?.conditions).toEqual([
      "browser",
      "development",
    ]);
    expect(resolveConfig(defineGameViteConfig(), build).resolve?.conditions).toEqual(["browser"]);
  });

  it("merges overrides last", () => {
    const config = resolveConfig(
      defineGameViteConfig({
        port: 4000,
        overrides: { server: { port: 4100 }, build: { sourcemap: true } },
      }),
      build,
    );
    expect(config.server).toMatchObject({ host: true, port: 4100 });
    expect(config.build?.sourcemap).toBe(true);
  });
});
