import { describe, expect, test } from "vitest";
import { PlayerSchema } from "../src/schema/PlayerSchema";

describe("PlayerSchema", () => {
  test("should instantiate PlayerSchema with defaults", () => {
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

  test("should allow updating id", () => {
    const player = new PlayerSchema();
    player.id = "new-id";
    expect(player.id).toBe("new-id");
  });

  test("should allow updating name", () => {
    const player = new PlayerSchema();
    player.name = "Bob";
    expect(player.name).toBe("Bob");
  });

  test("should allow updating role", () => {
    const player = new PlayerSchema();
    player.role = "audience";
    expect(player.role).toBe("audience");
  });
});
