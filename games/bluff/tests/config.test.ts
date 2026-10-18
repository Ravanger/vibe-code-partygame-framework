import { afterEach, describe, expect, it, vi } from "vitest";
import { readUrlCode, readUrlTvCode, resolveEndpoints } from "../ui/config.js";

const mockEnv = (over = {}) => ({
  VITE_SERVER_HOST: undefined,
  VITE_GAME_PORT: undefined,
  VITE_API_PORT: undefined,
  ...over,
});

afterEach(() => vi.unstubAllGlobals());

describe("resolveEndpoints", () => {
  it("uses the page host so LAN devices reach the right machine", () => {
    vi.stubGlobal("window", { location: { hostname: "192.168.1.50" } });
    expect(resolveEndpoints(mockEnv())).toEqual({
      endpoint: "http://192.168.1.50:2567",
      apiPort: 3001,
    });
  });

  it("respects the VITE_ overrides", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(
      resolveEndpoints(
        mockEnv({ VITE_SERVER_HOST: "10.0.0.1", VITE_GAME_PORT: "7777", VITE_API_PORT: "8888" }),
      ),
    ).toEqual({ endpoint: "http://10.0.0.1:7777", apiPort: 8888 });
  });
});

describe("share link codes", () => {
  it("reads ?code= and ?tv=, upper-cased and validated", () => {
    expect(readUrlCode("?code=qrst")).toBe("QRST");
    expect(readUrlTvCode("?tv=abcd")).toBe("ABCD");
    expect(readUrlCode("?tv=abcd")).toBeUndefined();
    expect(readUrlCode("?code=nope!")).toBeUndefined();
  });
});
