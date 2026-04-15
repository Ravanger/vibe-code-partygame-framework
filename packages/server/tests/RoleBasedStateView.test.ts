import { StateView } from "@colyseus/schema";
import { describe, expect, it, vi } from "vitest";
import { RoleBasedStateView } from "../src/rooms/RoleBasedStateView.js";
import { GameStateSchema } from "../src/schema/GameStateSchema.js";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

describe("RoleBasedStateView", () => {
  it("adds the room state to the state view", () => {
    const addSpy = vi.spyOn(StateView.prototype, "add").mockReturnValue(true);
    const state = new GameStateSchema();
    const viewer = new PlayerSchema();
    viewer.role = "player";

    const view = new RoleBasedStateView(state, viewer, {});

    expect(view).toBeInstanceOf(RoleBasedStateView);
    expect(addSpy).toHaveBeenCalledWith(state, 1);

    addSpy.mockRestore();
  });
});
