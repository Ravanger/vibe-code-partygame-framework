import { describe, it, expect } from "vitest";
import { GameRoom } from "../src/rooms/GameRoom";

describe("GameRoom Integration", () => {
  it("should initialize GameStateSchema", () => {
    const room = new GameRoom();
    room.onCreate();
    expect(room.state.phase).toBe("lobby");
  });
});
