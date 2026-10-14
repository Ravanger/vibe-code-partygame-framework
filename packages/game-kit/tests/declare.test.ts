import { describe, expect, it } from "vitest";
import { defineGamePackage, type GameDeclaration } from "../src/index.js";
import { TAP_ROOM, TapGame, TapState, tapKit } from "./fixtures/tapGame.js";

const declaration: GameDeclaration<TapState, undefined> = {
  meta: { roomName: TAP_ROOM, minPlayers: 2, maxPlayers: 6 },
  definition: () => TapGame,
  stateClass: TapState,
  isFinished: (state) => state.done,
  botKit: tapKit(),
};

describe("defineGamePackage", () => {
  it("returns the declaration unchanged", () => {
    expect(defineGamePackage(declaration)).toBe(declaration);
  });

  it("types load's result into definition's content", async () => {
    const pkg = defineGamePackage({
      ...declaration,
      load: async (env) => `loaded:${env.PORT}`,
      definition: (_content: string) => TapGame,
    });
    expect(pkg.load).toBeTypeOf("function");
    if (pkg.load === undefined) throw new Error("expected a loader");
    const content = await pkg.load({});
    expect(content).toBe("loaded:undefined");
    expect(pkg.definition(content)).toBe(TapGame);
  });
});
