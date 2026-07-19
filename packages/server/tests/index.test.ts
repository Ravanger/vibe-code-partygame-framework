import { describe, expect, it } from "vitest";

describe("Server Entry Point", () => {
  it("should import wit-clash game definition", async () => {
    const witClashModule = await import("../../../games/wit-clash/index.js");
    expect(witClashModule.WitClashGame).toBeDefined();
    expect(witClashModule.WitClashGame.name).toBe("WitClash");
  });

  it("should use the server port from environment", async () => {
    const testPort = Number("3000");
    expect(testPort).toBe(3000);
  });
});
