import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/launcher",
  coverage: ["src/**/*.ts"],
});
