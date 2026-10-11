import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/client-utils",
  coverage: ["src/**/*.ts"],
});
