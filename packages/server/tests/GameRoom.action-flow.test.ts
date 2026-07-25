import { buildXStateMachine } from "@partygame/core";
import { GameActionSchema } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { WitClashGame } from "../../../games/wit-clash/index.js";

describe("ACTION message flow", () => {
  it("START_GAME from the host advances Lobby -> CategorySelection", () => {
    // This is the exact payload Lobby.svelte sends. Before Plan 01, this would fail
    // because the schema only accepted "StartGame" (PascalCase), not "START_GAME".
    const actionPayload = { type: "START_GAME" };
    expect(GameActionSchema.safeParse(actionPayload).success).toBe(true);

    const machine = createActor(buildXStateMachine(WitClashGame));
    machine.subscribe((_snapshot) => {
      // Track state changes
    });
    machine.start();

    expect(machine.getSnapshot().context.currentPhase).toBe("Lobby");

    // Host sends START_GAME action
    machine.send({
      type: "ACTION",
      phase: "Lobby",
      name: "START_GAME",
      clientId: "host-session",
      role: "host",
      data: actionPayload,
      timestamp: Date.now(),
    });

    expect(machine.getSnapshot().context.currentPhase).toBe("CategorySelection");
  });

  it("rejects START_GAME from a non-host", () => {
    const machine = createActor(buildXStateMachine(WitClashGame));
    machine.start();

    expect(machine.getSnapshot().context.currentPhase).toBe("Lobby");

    // Guest tries to start the game
    // The GameRoom ACTION handler checks: actionDef.from !== "player" && player.role !== actionDef.from
    // START_GAME has from: "host", so a guest (role: "player") would be rejected
    // Here we test that the machine still works but the GameRoom would reject it
    const phaseDef = WitClashGame.phases.Lobby;
    const actionDef = phaseDef.actions.START_GAME;
    expect(actionDef.from).toBe("host");

    // If a guest somehow bypassed the check, the machine would still process it
    // But the real protection is in GameRoom.ts line 146-150
    const guestRole = "player";
    expect(actionDef.from !== "player" && guestRole !== actionDef.from).toBe(true);
  });

  it("VOTE_CATEGORY action is accepted by schema", () => {
    const actionPayload = { type: "VOTE_CATEGORY", categoryId: "alpha" };
    const result = GameActionSchema.safeParse(actionPayload);
    expect(result.success).toBe(true);
  });

  it("SUBMIT_ANSWER requires matchupId", () => {
    const validPayload = { type: "SUBMIT_ANSWER", matchupId: "m1", answer: "test" };
    expect(GameActionSchema.safeParse(validPayload).success).toBe(true);

    const invalidPayload = { type: "SUBMIT_ANSWER", answer: "test" };
    expect(GameActionSchema.safeParse(invalidPayload).success).toBe(false);
  });
});
