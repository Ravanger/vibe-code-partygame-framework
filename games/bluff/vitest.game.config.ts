import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "bluff-game",
  include: ["tests/game/**/*.test.ts", "tests/bots/**/*.test.ts", "tests/terminal/**/*.test.ts"],
  coverage: ["src/**/*.ts", "gamePackage.ts", "bots/**/*.ts", "terminal/**/*.ts"],
});
