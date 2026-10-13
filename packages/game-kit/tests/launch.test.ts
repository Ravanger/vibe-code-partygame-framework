import type { LaunchConfig } from "@partygame/launcher";
import type { BaseGameState } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { defineGamePackage, launch } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

describe("launch", () => {
  it("passes the built config and io.argv to the runLauncher seam", async () => {
    const kit = tapKit();
    const calls: [LaunchConfig<BaseGameState>, string[]][] = [];
    const game = defineGamePackage({
      meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
      displayName: "Tap Game",
      definition: () => TapGame,
      stateClass: TapState,
      isFinished: (state) => state.done,
      botKit: kit,
    });

    await launch(
      game,
      { gameDir: "/game" },
      {
        env: {},
        argv: ["dev", "--demo"],
        exit: () => {},
        log: () => {},
        error: () => {},
        runLauncher: async (config, argv) => {
          calls.push([config, argv]);
        },
      },
    );

    expect(calls).toHaveLength(1);
    const [first] = calls;
    if (first === undefined) throw new Error("runLauncher never ran");
    const [config, argv] = first;
    expect(argv).toEqual(["dev", "--demo"]);
    expect(config.name).toBe("Tap Game");
    expect(config.bots?.kit).toBe(kit);
  });
});
