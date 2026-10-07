import { uiTestConfig } from "@partygame/config/vitest";

export default uiTestConfig({
  name: "__slug__",
  exclude: ["tests/game/**", "tests/bots/**", "tests/terminal/**"],
  coverage: ["src/**/*.ts", "ui/**/*.ts"],
});
