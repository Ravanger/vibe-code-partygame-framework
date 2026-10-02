import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/core",
  coverage: ["src/**/*.ts"],
});
