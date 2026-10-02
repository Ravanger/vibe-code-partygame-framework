import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/bots",
  coverage: ["src/**/*.ts"],
});
