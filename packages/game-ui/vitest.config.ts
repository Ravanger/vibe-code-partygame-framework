import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({
  name: "@partygame/game-ui",
  coverage: ["src/**/*.{ts,svelte}"],
  setupFiles: ["./vitest.setup.ts"],
});
