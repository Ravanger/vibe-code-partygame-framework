import { describe, expect, test } from "vitest";
import { PlayerSchema } from "../src/schema/PlayerSchema";

describe("PlayerSchema", () => {
  test("should have default values", () => {
    const player = new PlayerSchema();
    expect(player.id).toBe("");
    expect(player.name).toBe("");
    expect(player.role).toBe("player");
  });

  test("should allow setting properties", () => {
    const player = new PlayerSchema();
    player.id = "player1";
    player.name = "Alice";
    player.role = "host";
    expect(player.id).toBe("player1");
    expect(player.name).toBe("Alice");
    expect(player.role).toBe("host");
  });
});
