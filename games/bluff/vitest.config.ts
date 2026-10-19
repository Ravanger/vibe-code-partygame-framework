import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({
  name: "bluff",
  exclude: ["tests/game/**", "tests/bots/**", "tests/terminal/**"],
  coverage: ["src/**/*.ts", "ui/**/*.ts"],
});
