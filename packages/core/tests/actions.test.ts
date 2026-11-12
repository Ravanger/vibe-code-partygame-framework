import { ErrorCode } from "@partygame/shared";
import { describe, expect, it } from "vitest";
import { defineGame, EmptyPayloadSchema, type PhaseState, playAgainAction } from "../src/index.js";
import { TestTable } from "../src/testing/index.js";

const definition = defineGame<PhaseState, Record<string, never>, Record<string, never>>({
  name: "Actions",
  version: "1",
  minPlayers: 2,
  maxPlayers: 6,
  startPhase: "Room",
  createPrivateState: () => ({}),
  phases: {
    Room: {
      actions: {
        PLAY_AGAIN: playAgainAction(),
      },
    },
  },
});

const table = (): TestTable<PhaseState, Record<string, never>, Record<string, never>> =>
  new TestTable({
    definition,
    state: { phase: "", phaseEndsAt: 0, canStart: false },
    options: {},
    players: 3,
  });

describe("EmptyPayloadSchema", () => {
  it("accepts an empty object", () => {
    expect(EmptyPayloadSchema.parse({})).toEqual({});
  });

  it("strips extra keys, as z.object({}) does today", () => {
    expect(EmptyPayloadSchema.parse({ type: "PLAY_AGAIN", extra: 1 })).toEqual({});
  });
});

describe("playAgainAction", () => {
  it("returns the room to the lobby from the host", () => {
    const t = table();
    t.start();
    expect(t.act("p1", "PLAY_AGAIN")).toBeUndefined();
    expect(t.state.phase).toBe("Lobby");
  });

  it("refuses a non-host sender", () => {
    const t = table();
    t.start();
    expect(t.act("p2", "PLAY_AGAIN")).toMatchObject({ code: ErrorCode.UNAUTHORIZED });
    expect(t.state.phase).toBe("Room");
  });
});
