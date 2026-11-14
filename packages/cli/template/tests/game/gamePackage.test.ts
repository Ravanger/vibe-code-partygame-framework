import { PlayerSchema } from "@partygame/shared/schema";
import { describe, expect, it } from "vitest";
import { gamePackage } from "../../gamePackage.js";
import { META } from "../../src/meta.js";
import { PHASE } from "../../src/phaseNames.js";
import { __PascalName__State } from "../../src/state.js";

describe("gamePackage", () => {
  it("describes the wave game for a server to host", () => {
    expect(gamePackage.meta).toBe(META);
    expect(gamePackage.stateClass).toBe(__PascalName__State);
    expect(gamePackage.definition(undefined).name).toBe(__DisplayNameJson__);
  });

  it("announces the results of every game, not only the first one in a run", () => {
    const commentator = gamePackage.demo?.commentator;
    if (commentator === undefined) throw new Error("the template demo declares no commentator");
    const { narrate } = commentator();

    const state = new __PascalName__State();
    const player = new PlayerSchema();
    player.id = "p1";
    player.name = "Ada";
    state.players.set("p1", player);
    state.waves.set("p1", 5);

    state.phase = PHASE.Results;
    state.winnerName = "Ada";
    state.winnerWaves = 5;
    expect(narrate(state)).toEqual(["Ada wins with 5 waves!"]);
    expect(narrate(state)).toEqual([]); // the same results are not re-announced

    // a second game starts in the same run
    state.phase = PHASE.Waving;
    expect(narrate(state)).toEqual(["Waves — Ada: 5"]);
    state.phase = PHASE.Results;
    state.winnerWaves = 7;
    expect(narrate(state)).toEqual(["Ada wins with 7 waves!"]);
  });
});
