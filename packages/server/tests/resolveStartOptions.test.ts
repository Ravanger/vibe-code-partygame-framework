import { describe, expect, it } from "vitest";
import { resolveStartOptions } from "../src/resolveStartOptions.js";
import { RoomCodeService } from "../src/services/RoomCodeService.js";

describe("resolveStartOptions", () => {
  it("defaults the ports and creates a room-code service", () => {
    const resolved = resolveStartOptions({}, {});
    expect(resolved.port).toBe(2567);
    expect(resolved.apiPort).toBe(3001);
    expect(resolved.roomCodeService).toBeInstanceOf(RoomCodeService);
    expect(resolved.allowedOrigins).toBeUndefined();
  });

  it("passes allowedOrigins through", () => {
    expect(
      resolveStartOptions({ allowedOrigins: ["http://party.example"] }, {}).allowedOrigins,
    ).toEqual(["http://party.example"]);
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

  it.each([
    ["PORT", "abc"],
    ["PORT", "70000"],
    ["PORT", "0"],
    ["PORT", ""],
    ["PORT", "2.5"],
    ["API_PORT", "-1"],
    ["API_PORT", "x"],
  ])("rejects %s=%j with one clear message", (name, value) => {
    expect(() => resolveStartOptions({}, { [name]: value })).toThrow(
      `${name} must be a whole number from 1 to 65535`,
    );
  });

  it("accepts the port bounds", () => {
    expect(resolveStartOptions({}, { PORT: "1", API_PORT: "65535" })).toMatchObject({
      port: 1,
      apiPort: 65535,
    });
  });

  it("does not read an environment port that explicit options override", () => {
    expect(
      resolveStartOptions({ port: 5, apiPort: 6 }, { PORT: "abc", API_PORT: "x" }),
    ).toMatchObject({ port: 5, apiPort: 6 });
  });
});
