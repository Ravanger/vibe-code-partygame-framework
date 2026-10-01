import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  actionFactory,
  defineGame,
  type GameDefinition,
  GameDefinitionError,
  type PhaseState,
} from "../../src/index.js";

type S = PhaseState;
const valid = (): GameDefinition<S> => ({
  name: "G",
  minPlayers: 2,
  maxPlayers: 4,
  startPhase: "Play",
  createPrivateState: () => ({}),
  phases: { Play: {} },
});

const errorsOf = (spec: GameDefinition<S>): string => {
  try {
    defineGame(spec);
  } catch (e) {
    expect(e).toBeInstanceOf(GameDefinitionError);
    return (e as GameDefinitionError).message;
  }
  return "";
};

describe("defineGame", () => {
  it("returns a valid spec unchanged", () => {
    const spec = valid();
    expect(defineGame(spec)).toBe(spec);
  });

  it("rejects an empty name", () => {
    expect(errorsOf({ ...valid(), name: "" })).toContain("name");
  });

  it("rejects bad player limits", () => {
    expect(errorsOf({ ...valid(), minPlayers: 0 })).toContain("minPlayers");
    expect(errorsOf({ ...valid(), minPlayers: 1.5 })).toContain("minPlayers");
    expect(errorsOf({ ...valid(), minPlayers: 5, maxPlayers: 4 })).toContain("maxPlayers");
  });

  it("reserves Lobby", () => {
    expect(errorsOf({ ...valid(), phases: { Play: {}, Lobby: {} } })).toContain("Lobby");
  });

  it("rejects invalid phase names", () => {
    expect(errorsOf({ ...valid(), phases: { Play: {}, "a.b": {} } })).toContain('"a.b"');
  });

  it("requires startPhase to be declared", () => {
    expect(errorsOf({ ...valid(), startPhase: "Nope" })).toContain("startPhase");
  });

  it("requires onTimeout with a duration", () => {
    expect(errorsOf({ ...valid(), phases: { Play: { duration: 100 } } })).toContain("onTimeout");
    expect(errorsOf({ ...valid(), phases: { Play: { duration: () => 100 } } })).toContain(
      "onTimeout",
    );
  });

  it("accepts a duration with onTimeout", () => {
    expect(errorsOf({ ...valid(), phases: { Play: { duration: 1, onTimeout: () => {} } } })).toBe(
      "",
    );
  });

  it("rejects bad or reserved action names", () => {
    const handler = () => {};
    const payload = z.object({});
    const bad = errorsOf({
      ...valid(),
      phases: { Play: { actions: { lower: { from: "player", payload, handler } } } },
    });
    expect(bad).toContain('"lower"');
    const reserved = errorsOf({
      ...valid(),
      phases: { Play: { actions: { START_GAME: { from: "host", payload, handler } } } },
    });
    expect(reserved).toContain("START_GAME");
    for (const name of ["KICK_PLAYER", "SET_OPTIONS"]) {
      const message = errorsOf({
        ...valid(),
        phases: { Play: { actions: { [name]: { from: "host", payload, handler } } } },
      });
      expect(message).toContain(`${name} is reserved`);
    }
  });

  it("reports every problem at once", () => {
    const message = errorsOf({ ...valid(), name: "", startPhase: "X" });
    expect(message).toContain("name");
    expect(message).toContain("startPhase");
  });
});

describe("actionFactory", () => {
  it("returns the spec it is given", () => {
    const action = actionFactory<S, Record<string, never>, Record<string, unknown>>();
    const spec = { from: "player" as const, payload: z.object({}), handler: () => {} };
    expect(action(spec)).toBe(spec);
  });
});
