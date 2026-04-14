import { describe, it, expect } from "vitest";
import { GameRoom } from "../src/rooms/GameRoom";

describe("GameRoom", () => {
  it("can be instantiated", () => {
    const room = new GameRoom();
    expect(room).toBeDefined();
  });
});
