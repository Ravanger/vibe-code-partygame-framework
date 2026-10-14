import { DemoTable } from "@partygame/bots";
import { describe, expect, it } from "vitest";
import { buildLaunchConfig, demoTableOptions } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const isFinished = (state: TapState): boolean => state.done;

const base = {
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  isFinished,
};

describe("buildLaunchConfig", () => {
  it("names the launch from displayName or falls back to the room name", () => {
    const named = buildLaunchConfig(
      { ...base, displayName: "Tap Game", botKit: tapKit() },
      { gameDir: "/game" },
    );
    expect(named.name).toBe("Tap Game");
    const unnamed = buildLaunchConfig({ ...base, botKit: tapKit() }, { gameDir: "/game" });
    expect(unnamed.name).toBe(TAP_ROOM);
  });

  it("passes the game dir and caps bots and demo between the meta limits", () => {
    const config = buildLaunchConfig({ ...base, botKit: tapKit() }, { gameDir: "/game" });
    expect(config.gameDir).toBe("/game");
    expect(config.bots?.max).toBe(5);
    expect(config.demo?.min).toBe(1);
    expect(config.demo?.max).toBe(5);
  });

  it("keeps the declaration's botKit for --bots even when the demo overrides the kit", () => {
    const kit = tapKit();
    const config = buildLaunchConfig(
      { ...base, botKit: kit, demo: { kit: tapKit() } },
      { gameDir: "/game" },
    );
    expect(config.bots?.kit).toBe(kit);
  });

  it("creates a demo table from the connection", () => {
    const config = buildLaunchConfig({ ...base, botKit: tapKit() }, { gameDir: "/game" });
    const table = config.demo?.create({ endpoint: "ws://127.0.0.1:1", apiPort: 2, bots: 2 });
    expect(table).toBeInstanceOf(DemoTable);
  });
});

describe("demoTableOptions", () => {
  it("uses the declaration's botKit and passes the connection through", () => {
    const kit = tapKit();
    const options = demoTableOptions(
      { ...base, botKit: kit },
      { endpoint: "ws://x", apiPort: 1, bots: 2 },
    );
    expect(options.roomName).toBe(TAP_ROOM);
    expect(options.stateClass).toBe(TapState);
    expect(options.strategy).toBe(kit.strategy);
    expect(options.bots).toBe(2);
    expect(options.isFinished).toBe(isFinished);
  });

  it("honours the demo kit, roomOptions and hostName overrides", () => {
    const other = tapKit();
    const options = demoTableOptions(
      { ...base, botKit: tapKit(), demo: { kit: other, roomOptions: { a: 1 }, hostName: "H" } },
      { endpoint: "ws://x", apiPort: 1, bots: 3 },
    );
    expect(options.strategy).toBe(other.strategy);
    expect(options.roomOptions).toEqual({ a: 1 });
    expect(options.hostName).toBe("H");
  });

  it("merges the demo bot options under the connection's", () => {
    const options = demoTableOptions(
      { ...base, botKit: tapKit(), demo: { bot: { thinkMs: [1, 2] } } },
      { endpoint: "ws://x", apiPort: 1, bots: 1, bot: { reactMs: [3, 4] } },
    );
    expect(options.bot).toEqual({ thinkMs: [1, 2], reactMs: [3, 4] });
  });

  it("uses the connection bot when only the connection sets it", () => {
    const options = demoTableOptions(
      { ...base, botKit: tapKit() },
      { endpoint: "ws://x", apiPort: 1, bots: 1, bot: { reactMs: [3, 4] } },
    );
    expect(options.bot).toEqual({ reactMs: [3, 4] });
  });

  it("uses the demo bot when only the demo sets it", () => {
    const options = demoTableOptions(
      { ...base, botKit: tapKit(), demo: { bot: { thinkMs: [1, 2] } } },
      { endpoint: "ws://x", apiPort: 1, bots: 1 },
    );
    expect(options.bot).toEqual({ thinkMs: [1, 2] });
  });

  it("omits bot when neither side sets it", () => {
    const options = demoTableOptions(
      { ...base, botKit: tapKit() },
      { endpoint: "ws://x", apiPort: 1, bots: 1 },
    );
    expect(options.bot).toBeUndefined();
  });
});
