import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/terminal",
  coverage: ["src/**/*.ts"],
});
