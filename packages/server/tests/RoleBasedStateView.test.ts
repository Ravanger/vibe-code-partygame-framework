import { StateView } from "@colyseus/schema";
import { describe, expect, it } from "vitest";
import { RoleBasedStateView } from "../src/rooms/RoleBasedStateView.js";
import { GameStateSchema } from "../src/schema/GameStateSchema.js";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

describe("RoleBasedStateView", () => {
  it("creates a StateView instance", () => {
    const state = new GameStateSchema();
    const viewer = new PlayerSchema();
    viewer.role = "player";

    const view = new RoleBasedStateView(state, viewer, {});

    expect(view).toBeInstanceOf(RoleBasedStateView);
    expect(view).toBeInstanceOf(StateView);
  });
});
