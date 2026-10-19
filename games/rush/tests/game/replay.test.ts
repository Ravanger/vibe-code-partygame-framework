import { actionLogMiddleware, type GameDefinition, getActionLog } from "@partygame/core";
import { replayLog } from "@partygame/core/testing";
import { describe, expect, it } from "vitest";
import { createRushGame } from "../../src/game.js";
import { type RushOptions, RushOptionsSchema } from "../../src/options.js";
import type { RushPrivate } from "../../src/private.js";
import { RushState } from "../../src/state.js";
import { Table } from "./support.js";

describe("replay", () => {
  it("reproduces a tapped race to the same final state", () => {
    const definition = createRushGame();
    const logging: GameDefinition<RushState, RushPrivate, RushOptions> = {
      ...definition,
      middleware: [actionLogMiddleware()],
    };
    const options = RushOptionsSchema.parse({ raceSeconds: 5 });
    const t = new Table({ players: 4, seed: 7, options: { raceSeconds: 5 }, definition: logging });
    t.start();
    t.tick(350);
    t.tap("p2");
    t.tick(1200);
    t.tap("p3");
    t.tap("p2");
    t.tick(3450); // 5000 in total: the race times out into Results
    expect(t.phase).toBe("Results");

    const log = getActionLog(t.priv);
    if (log === undefined) throw new Error("expected an action log");
    const { states } = replayLog(logging, log, { state: new RushState(), options });
    const last = states[states.length - 1];
    expect(last?.phase).toBe("Results");
    expect(last?.targetX).toBe(t.state.targetX);
    expect(last?.targetY).toBe(t.state.targetY);
    expect(last?.taps).toEqual(Object.fromEntries(t.state.taps));
    expect(last?.hits).toEqual(Object.fromEntries(t.state.hits));
    expect((last?.entries ?? []).map((e) => [e.playerId, e.hits])).toEqual(
      t.state.entries.map((e) => [e.playerId, e.hits]),
    );
  });
});
