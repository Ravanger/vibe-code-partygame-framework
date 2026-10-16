import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/content",
  coverage: ["src/**/*.ts"],
});
