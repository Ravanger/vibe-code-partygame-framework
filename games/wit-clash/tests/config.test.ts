import { describe, expect, it, vi } from "vitest";
import { readMinPlayers, resolveEndpoints } from "../ui/config.js";

const mockEnv = (over = {}) => ({
  VITE_SERVER_HOST: undefined,
  VITE_GAME_PORT: undefined,
  VITE_API_PORT: undefined,
  ...over,
});

describe("resolveEndpoints", () => {
  it("uses the current hostname so LAN devices reach the right machine", () => {
    vi.stubGlobal("window", { location: { hostname: "192.168.1.50" } });
    expect(resolveEndpoints(mockEnv())).toEqual({
      endpoint: "http://192.168.1.50:2567",
      apiPort: 3001,
    });
  });

  it("works on localhost", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveEndpoints(mockEnv()).endpoint).toBe("http://localhost:2567");
  });

  it("respects VITE_SERVER_HOST override", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveEndpoints(mockEnv({ VITE_SERVER_HOST: "10.0.0.1" })).endpoint).toBe(
      "http://10.0.0.1:2567",
    );
  });

  it("respects VITE_GAME_PORT override", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveEndpoints(mockEnv({ VITE_GAME_PORT: "9999" })).endpoint).toBe(
      "http://localhost:9999",
    );
  });

  it("respects VITE_API_PORT override", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(resolveEndpoints(mockEnv({ VITE_API_PORT: "8080" })).apiPort).toBe(8080);
  });

  it("uses default param when called without args", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const result = resolveEndpoints();
    expect(result.endpoint).toContain("localhost");
  });
});

describe("readMinPlayers", () => {
  it("returns default 3 when VITE_MIN_PLAYERS is not set", () => {
    expect(readMinPlayers(mockEnv())).toBe(3);
  });

  it("returns custom value when VITE_MIN_PLAYERS is set", () => {
    expect(readMinPlayers(mockEnv({ VITE_MIN_PLAYERS: "5" }))).toBe(5);
  });

  it("returns default 3 when VITE_MIN_PLAYERS is 0", () => {
    expect(readMinPlayers(mockEnv({ VITE_MIN_PLAYERS: "0" }))).toBe(3);
  });

  it("returns default 3 when VITE_MIN_PLAYERS is negative", () => {
    expect(readMinPlayers(mockEnv({ VITE_MIN_PLAYERS: "-1" }))).toBe(3);
  });

  it("returns default 3 when VITE_MIN_PLAYERS is not a number", () => {
    expect(readMinPlayers(mockEnv({ VITE_MIN_PLAYERS: "abc" }))).toBe(3);
  });
});
