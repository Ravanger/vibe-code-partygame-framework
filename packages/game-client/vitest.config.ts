import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({
  name: "@partygame/game-client",
  coverage: ["src/**/*.ts"],
  setupFiles: ["./vitest.setup.ts"],
});
