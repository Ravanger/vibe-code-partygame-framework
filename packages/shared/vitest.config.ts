import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/shared",
  coverage: ["src/**/*.ts"],
});
