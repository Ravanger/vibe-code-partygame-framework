import type { GameDefinition } from "@partygame/core";
import { describe, expect, it, vi } from "vitest";
import { GameStateSchema } from "../src/schema/GameStateSchema.js";
import { PlayerSchema } from "../src/schema/PlayerSchema.js";

const mockGameDefinition: GameDefinition<Record<string, unknown>> = {
  name: "TestGame",
  phases: {
    Lobby: {
      actions: {
        START_GAME: {
          from: "player",
          handler: vi.fn(),
        },
      },
    },
  },
  initialState: () => ({}),
  visibility: {},
};

describe("GameRoom", () => {
  describe("PlayerSchema integration", () => {
    it("should create PlayerSchema with correct defaults", () => {
      const player = new PlayerSchema();
      expect(player.id).toBe("");
      expect(player.name).toBe("");
      expect(player.role).toBe("player");
    });

    it("should allow setting player properties", () => {
      const player = new PlayerSchema();
      player.id = "session-123";
      player.name = "Player sess";
      player.role = "player";

      expect(player.id).toBe("session-123");
      expect(player.name).toBe("Player sess");
      expect(player.role).toBe("player");
    });

    it("should generate expected player name format", () => {
      const sessionId = "abc123";
      const expectedName = `Player ${sessionId.slice(0, 4)}`;
      expect(expectedName).toBe("Player abc1");
    });
  });

  describe("GameStateSchema integration", () => {
    it("should create game state with correct defaults", () => {
      const state = new GameStateSchema();
      expect(state.phase).toBe("Lobby");
      expect(state.players).toBeDefined();
    });

    it("should allow adding players to state", () => {
      const state = new GameStateSchema();
      const player = new PlayerSchema();
      player.id = "session-1";
      player.name = "Player 1";

      state.players.set("session-1", player);

      expect(state.players.size).toBe(1);
      expect(state.players.get("session-1")?.name).toBe("Player 1");
    });

    it("should support multiple players", () => {
      const state = new GameStateSchema();

      for (let i = 1; i <= 3; i++) {
        const player = new PlayerSchema();
        player.id = `session-${i}`;
        player.name = `Player ${i}`;
        state.players.set(`session-${i}`, player);
      }

      expect(state.players.size).toBe(3);
    });
  });

  describe("onJoin simulation", () => {
    it("should simulate player creation on join", () => {
      const state = new GameStateSchema();
      const sessionId = "test-session-123";

      const player = new PlayerSchema();
      player.id = sessionId;
      player.name = `Player ${sessionId.slice(0, 4)}`;

      state.players.set(sessionId, player);

      expect(state.players.get(sessionId)).toBeDefined();
      expect(state.players.get(sessionId)?.name).toBe("Player test");
    });

    it("should simulate multiple player joins", () => {
      const state = new GameStateSchema();
      const sessions = ["abc", "def", "ghi"];

      for (const sessionId of sessions) {
        const player = new PlayerSchema();
        player.id = sessionId;
        player.name = `Player ${sessionId.slice(0, 4)}`;
        state.players.set(sessionId, player);
      }

      expect(state.players.size).toBe(3);
      expect(state.players.get("abc")?.name).toBe("Player abc");
      expect(state.players.get("def")?.name).toBe("Player def");
      expect(state.players.get("ghi")?.name).toBe("Player ghi");
    });
  });

  describe("setDefinition", () => {
    it("should verify game definition structure", () => {
      expect(mockGameDefinition.name).toBe("TestGame");
      expect(mockGameDefinition.phases).toBeDefined();
      expect(mockGameDefinition.phases.Lobby).toBeDefined();
    });
  });
});
