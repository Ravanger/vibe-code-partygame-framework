import { describe, expect, it } from "vitest";
import { GameRoomState, type ServerGameRoomState } from "../src/state.svelte.js";

describe("GameRoomState", () => {
  it("should import state", async () => {
    const state = await import("../src/state.svelte.js");
    expect(state).toBeDefined();
  });

  it("should initialize with default values", () => {
    const state = new GameRoomState();
    expect(state.phase).toBe("lobby");
    expect(state.publicData).toBe("{}");
    expect(state.roomCode).toBe("");
  });

  it("should sync partial state with only phase", () => {
    const state = new GameRoomState();
    state.sync({ phase: "playing" } as ServerGameRoomState);
    expect(state.phase).toBe("playing");
    expect(state.publicData).toBe("{}");
    expect(state.roomCode).toBe("");
  });

  it("should sync partial state with only publicData", () => {
    const state = new GameRoomState();
    state.sync({ publicData: '{"score": 100}' } as ServerGameRoomState);
    expect(state.phase).toBe("lobby");
    expect(state.publicData).toBe('{"score": 100}');
  });

  it("should sync partial state with only roomCode", () => {
    const state = new GameRoomState();
    state.sync({ roomCode: "ABC123" } as ServerGameRoomState);
    expect(state.roomCode).toBe("ABC123");
  });

  it("should sync all fields", () => {
    const state = new GameRoomState();
    state.sync({
      phase: "voting",
      publicData: '{"winner": "p1"}',
      roomCode: "XYZ789",
    } as ServerGameRoomState);
    expect(state.phase).toBe("voting");
    expect(state.publicData).toBe('{"winner": "p1"}');
    expect(state.roomCode).toBe("XYZ789");
  });
});
