import { describe, expect, it } from "vitest";
import { GameRoomState } from "../src/state.svelte.js";

describe("GameRoomState Sync", () => {
  it("should sync all state fields", () => {
    const state = new GameRoomState();
    state.sync({
      phase: "Prompting",
      publicData: '{"test": true}',
      roomCode: "ABCD"
    });

    expect(state.phase).toBe("Prompting");
    expect(state.publicData).toBe('{"test": true}');
    expect(state.roomCode).toBe("ABCD");
  });

  it("should ignore undefined fields during sync", () => {
    const state = new GameRoomState();
    state.phase = "original";
    
    state.sync({} as any);
    
    expect(state.phase).toBe("original");
  });
});
