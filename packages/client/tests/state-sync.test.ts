import { describe, expect, it } from "vitest";
import { GameRoomState } from "../src/state.svelte.js";

describe("GameRoomState", () => {
  describe("constructor", () => {
    it("should have default values", () => {
      const state = new GameRoomState();
      expect(state.phase).toBe("lobby");
      expect(state.publicData).toBe("{}");
      expect(state.roomCode).toBe("");
    });
  });

  describe("sync", () => {
    it("should sync all state fields", () => {
      const state = new GameRoomState();
      state.sync({
        phase: "Prompting",
        publicData: '{"test": true}',
        roomCode: "ABCD",
      });

      expect(state.phase).toBe("Prompting");
      expect(state.publicData).toBe('{"test": true}');
      expect(state.roomCode).toBe("ABCD");
    });

    it("should ignore undefined fields during sync", () => {
      const state = new GameRoomState();
      state.phase = "original";

      state.sync({});

      expect(state.phase).toBe("original");
    });

    it("should sync phase only", () => {
      const state = new GameRoomState();
      state.sync({ phase: "Voting", publicData: "", roomCode: "" });
      expect(state.phase).toBe("Voting");
    });

    it("should sync publicData only", () => {
      const state = new GameRoomState();
      state.sync({ phase: "", publicData: '{"score":100}', roomCode: "" });
      expect(state.publicData).toBe('{"score":100}');
    });

    it("should sync roomCode only", () => {
      const state = new GameRoomState();
      state.sync({ phase: "", publicData: "", roomCode: "ABC123" });
      expect(state.roomCode).toBe("ABC123");
    });
  });
});
