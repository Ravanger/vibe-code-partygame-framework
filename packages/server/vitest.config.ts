import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/server",
  coverage: ["src/**/*.ts"],
  overrides: { test: { deps: { interopDefault: true } } },
});
