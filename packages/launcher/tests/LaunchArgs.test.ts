import { describe, expect, it } from "vitest";
import { parseLaunchArgs } from "../src/LaunchArgs.js";
import type { LaunchConfig, LaunchDemo } from "../src/types.js";
import { TapState } from "./fixtures/tapGame.js";

const kit = { roomName: "tap", stateClass: TapState, strategy: { play: () => {} } };
const demoOf = (min: number, max: number): LaunchDemo<TapState> => ({
  min,
  max,
  create: () => {
    throw new Error("not used");
  },
});
const full: LaunchConfig<TapState> = {
  gameDir: ".",
  name: "Tap",
  bots: { kit, max: 7 },
  demo: demoOf(2, 7),
};
const botsOnly: LaunchConfig<TapState> = { gameDir: ".", name: "Tap", bots: { kit, max: 7 } };
const demoOnly: LaunchConfig<TapState> = { gameDir: ".", name: "Tap", demo: demoOf(2, 7) };
const plain: LaunchConfig<TapState> = { gameDir: ".", name: "Tap" };

const value = (argv: string[], config = full) => {
  const parsed = parseLaunchArgs(argv, config);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};
const error = (argv: string[], config = full) => {
  const parsed = parseLaunchArgs(argv, config);
  if (parsed.ok) throw new Error("expected a refusal");
  return parsed.error;
};

describe("parseLaunchArgs", () => {
  it("defaults to dev with the browser on", () => {
    expect(value([])).toEqual({ mode: "dev", openBrowser: true });
  });

  it("reads the mode and --no-browser", () => {
    expect(value(["host", "--no-browser"])).toEqual({ mode: "host", openBrowser: false });
    expect(value(["prod"])).toEqual({ mode: "prod", openBrowser: true });
  });

  it("reads --bots with its default and an explicit count", () => {
    expect(value(["--bots"]).bots).toBe(3);
    expect(value(["--bots=7"]).bots).toBe(7);
    expect(value(["--bots"], { ...full, bots: { kit, max: 7, default: 5 } }).bots).toBe(5);
  });

  it("reads --demo with a clamped default and an explicit count", () => {
    expect(value(["--demo"]).demo).toBe(3);
    expect(value(["--demo=2"]).demo).toBe(2);
    expect(value(["--demo"], { ...full, demo: demoOf(4, 7) }).demo).toBe(4);
    expect(value(["--demo"], { ...full, demo: demoOf(1, 2) }).demo).toBe(2);
  });

  it("builds the usage from the config's ranges", () => {
    expect(error(["--bots=8"])).toBe(
      "Usage: launch [dev|host|prod] [--no-browser] [--bots[=1..7] | --demo[=2..7]]",
    );
    expect(error(["--bots=0"], botsOnly)).toBe(
      "Usage: launch [dev|host|prod] [--no-browser] [--bots[=1..7]]",
    );
    expect(error(["x"], demoOnly)).toBe(
      "Usage: launch [dev|host|prod] [--no-browser] [--demo[=2..7]]",
    );
    expect(error(["x"], plain)).toBe("Usage: launch [dev|host|prod] [--no-browser]");
  });

  it("refuses counts out of range or not integers", () => {
    expect(error(["--bots=8"])).toContain("Usage");
    expect(error(["--bots=0"])).toContain("Usage");
    expect(error(["--bots=x"])).toContain("Usage");
    expect(error(["--demo=1"])).toContain("Usage");
    expect(error(["--demo=8"])).toContain("Usage");
  });

  it("refuses --bots and --demo together", () => {
    expect(error(["--bots", "--demo"])).toBe(
      "--demo and --bots cannot be combined: --demo opens its own watch-only room.",
    );
  });

  it("refuses --bots or --demo the game does not support", () => {
    expect(error(["--bots"], plain)).toContain("Usage");
    expect(error(["--demo"], plain)).toContain("Usage");
  });

  it("refuses an unknown mode, two positionals and an unknown flag", () => {
    expect(error(["nope"])).toContain("Usage");
    expect(error(["dev", "host"])).toContain("Usage");
    expect(error(["--verbose"])).toContain("Usage");
  });
});
