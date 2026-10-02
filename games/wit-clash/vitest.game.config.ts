import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "wit-clash-game",
  include: ["tests/game/**/*.test.ts", "tests/bots/**/*.test.ts", "tests/terminal/**/*.test.ts"],
  coverage: ["src/**/*.ts", "bots/**/*.ts", "terminal/**/*.ts"],
});
