import { connectedClient } from "@partygame/game-client/testing";
import { NAME_MAX_LENGTH } from "@partygame/shared";
import { BaseGameState } from "@partygame/shared/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NameField } from "../src/NameField.svelte.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NameField", () => {
  it("starts from the name the seat already has", () => {
    const c = connectedClient({ stateClass: BaseGameState, seat: { name: "Ann" } });
    expect(new NameField(c.manager).draft).toBe("Ann");
  });

  it("sends one trimmed, capped name once typing pauses", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    const field = new NameField(c.manager);
    field.set("A");
    field.set(`  ${"x".repeat(NAME_MAX_LENGTH + 10)}  `);
    expect(field.draft).toBe(`  ${"x".repeat(NAME_MAX_LENGTH + 10)}  `);
    expect(c.room.sent).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "x".repeat(NAME_MAX_LENGTH) }]);
  });

  it("sends nothing for a blank name", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    const field = new NameField(c.manager);
    field.set("   ");
    vi.advanceTimersByTime(500);
    expect(c.room.sent).toEqual([]);
  });

  it("cancels a pending name on destroy", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    const field = new NameField(c.manager);
    field.set("Bo");
    field.destroy();
    vi.advanceTimersByTime(500);
    expect(c.room.sent).toEqual([]);
  });

  it("waits for a custom pause", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    new NameField(c.manager, 1000).set("Bo");
    vi.advanceTimersByTime(999);
    expect(c.room.sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(c.room.sent).toEqual([{ type: "SET_NAME", payload: "Bo" }]);
  });

  it("starts empty with no seat", () => {
    const c = connectedClient({ stateClass: BaseGameState });
    c.state.players.delete(c.manager.playerId);
    expect(new NameField(c.manager).draft).toBe("");
  });
});
