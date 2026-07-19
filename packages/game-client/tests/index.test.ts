import { describe, expect, it } from "vitest";
import * as index from "../src/index.js";

describe("SDK Exports", () => {
  it("should export GameClient and createGameClient", () => {
    expect(index.GameClient).toBeDefined();
    expect(index.createGameClient).toBeDefined();
  });

  it("should create a GameClient instance", () => {
    const client = index.createGameClient({ roomCode: "ROOM" });

    expect(client).toBeInstanceOf(index.GameClient);
    expect(client.connectionStatus).toBe("disconnected");
  });
});
