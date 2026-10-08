import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "cli",
  coverage: ["src/**/*.ts"],
});
