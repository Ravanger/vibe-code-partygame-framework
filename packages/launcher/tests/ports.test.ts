import { defineGameViteConfig } from "@partygame/config/vite";
import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { DEFAULT_PORTS, defaultCommands } from "../src/index.js";

const serve: ConfigEnv = { command: "serve", mode: "development" };

describe("DEFAULT_PORTS", () => {
  it("pins the launcher's port defaults", () => {
    expect(DEFAULT_PORTS).toEqual({ game: 2567, api: 3001, clientDev: 5173, production: 3000 });
  });

  it("matches the Vite preset's default dev server port", () => {
    const factory = defineGameViteConfig();
    if (typeof factory !== "function") throw new Error("expected a config function");
    const config = factory(serve);
    if (config instanceof Promise) throw new Error("expected a synchronous config");
    expect((config as UserConfig).server?.port).toBe(DEFAULT_PORTS.clientDev);
  });

  it("pins Vite to the dev client port in the default dev command", () => {
    expect(defaultCommands(DEFAULT_PORTS).dev).toEqual([
      process.execPath,
      "run",
      "dev",
      "--strictPort",
      "--port",
      String(DEFAULT_PORTS.clientDev),
    ]);
  });
});
