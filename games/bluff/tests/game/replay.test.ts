import { getActionLog } from "@partygame/core";
import { replayLog } from "@partygame/core/testing";
import { describe, expect, it } from "vitest";
import { promptsFromArray } from "../../src/content/PromptRepository.js";
import { createBluffGame } from "../../src/game.js";
import { BluffOptionsSchema } from "../../src/options.js";
import { BluffState } from "../../src/state.js";
import { FIXTURE_PROMPTS, Table } from "./support.js";

describe("replay", () => {
  it("reproduces a played round to the same final state", () => {
    const definition = createBluffGame({ prompts: promptsFromArray(FIXTURE_PROMPTS) });
    const options = BluffOptionsSchema.parse({ rounds: 1 });
    const t = new Table({ players: 4, seed: 7, options: { rounds: 1 } });
    t.start();
    for (const playerId of ["p1", "p2", "p3", "p4"]) t.submitFake(playerId, `a fake ${playerId}`);
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      const own = t.state.mine.get(playerId)?.myOptionId ?? "";
      const index = t.state.choices.findIndex((o) => o.id === own) === 0 ? 1 : 0;
      t.voteFor(playerId, index);
    }
    t.tick(20_000); // past the default 15 s reveal: the final round ends in Results
    expect(t.phase).toBe("Results");

    const log = getActionLog(t.priv);
    if (log === undefined) throw new Error("expected an action log");
    const { states } = replayLog(definition, log, { state: new BluffState(), options });
    const last = states[states.length - 1];
    expect(last?.phase).toBe("Results");
    expect(last?.promptText).toBe(t.state.promptText);
    expect(last?.results.map((e) => [e.playerId, e.roundPoints])).toEqual(
      t.state.results.map((e) => [e.playerId, e.roundPoints]),
    );
    expect(last?.scoreboard.map((e) => [e.playerId, e.score])).toEqual(
      t.state.scoreboard.map((e) => [e.playerId, e.score]),
    );
  });
});
