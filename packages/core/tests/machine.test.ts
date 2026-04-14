import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { buildXStateMachine } from "../src/machine.js";

describe("XState Machine", () => {
  it("should initialize with correct phase", () => {
    const mockDef = {
      name: "test",
      minPlayers: 1,
      maxPlayers: 2,
      initialState: () => ({}),
      phases: {},
    };
    const machine = buildXStateMachine(mockDef);
    const actor = createActor(machine);
    actor.start();
    expect(actor.getSnapshot().context.currentPhase).toBe("lobby");
  });
});
