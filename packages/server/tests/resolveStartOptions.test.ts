import { describe, expect, it } from "vitest";
import { resolveStartOptions } from "../src/resolveStartOptions.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

describe("resolveStartOptions", () => {
  it("defaults the ports and creates a room-code service", () => {
    const resolved = resolveStartOptions({}, {});
    expect(resolved.port).toBe(2567);
    expect(resolved.apiPort).toBe(3001);
    expect(resolved.roomCodeService).toBeInstanceOf(RoomCodeService);
  });

  it("reads PORT and API_PORT from the environment", () => {
    expect(resolveStartOptions({}, { PORT: "4000", API_PORT: "4001" })).toMatchObject({
      port: 4000,
      apiPort: 4001,
    });
  });

  it("prefers explicit options over the environment", () => {
    const roomCodeService = new RoomCodeService();
    const resolved = resolveStartOptions(
      { port: 1, apiPort: 2, roomCodeService },
      { PORT: "4000", API_PORT: "4001" },
    );
    expect(resolved).toEqual({ port: 1, apiPort: 2, roomCodeService });
  });
});
