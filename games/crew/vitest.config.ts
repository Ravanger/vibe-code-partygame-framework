import { nodeTestConfig } from "@partygame/config/vitest";

export default nodeTestConfig({
  name: "crew-game",
  include: ["tests/game/**/*.test.ts"],
  coverage: ["src/**/*.ts"],
});
