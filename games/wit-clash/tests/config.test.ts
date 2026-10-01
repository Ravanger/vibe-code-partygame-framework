import { describe, expect, it, vi } from "vitest";
import { readUrlCode, readUrlTvCode, resolveEndpoints } from "../ui/config.js";

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

describe("readUrlCode", () => {
  it("reads a valid share-link code, upper-cased", () => {
    expect(readUrlCode("?code=abcd")).toBe("ABCD");
    expect(readUrlCode("?x=1&code=WXYZ")).toBe("WXYZ");
  });

  it("ignores a missing or malformed code", () => {
    expect(readUrlCode("")).toBeUndefined();
    expect(readUrlCode("?code=ab1")).toBeUndefined();
    expect(readUrlCode("?code=ABCDE")).toBeUndefined();
  });

  it("defaults to the page URL", () => {
    vi.stubGlobal("window", { location: { search: "?code=QRST", hostname: "localhost" } });
    expect(readUrlCode()).toBe("QRST");
  });
});

describe("readUrlTvCode", () => {
  it("reads a valid TV link code, upper-cased, and ignores the share code", () => {
    expect(readUrlTvCode("?tv=abcd")).toBe("ABCD");
    expect(readUrlTvCode("?code=WXYZ")).toBeUndefined();
    expect(readUrlTvCode("?tv=ab1")).toBeUndefined();
  });

  it("defaults to the page URL", () => {
    vi.stubGlobal("window", { location: { search: "?tv=QRST", hostname: "localhost" } });
    expect(readUrlTvCode()).toBe("QRST");
  });
});
