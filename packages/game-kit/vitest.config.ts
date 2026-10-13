import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "@partygame/game-kit",
  coverage: ["src/**/*.ts"],
});
