import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientConfig,
  readCodeParam,
  readUrlCode,
  readUrlTvCode,
  resolveEndpoints,
} from "../src/urls.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveEndpoints", () => {
  it("defaults to the page host and the standard ports", () => {
    expect(resolveEndpoints({}, "192.168.1.5")).toEqual({
      endpoint: "http://192.168.1.5:2567",
      apiPort: 3001,
    });
  });

  it("takes overrides", () => {
    expect(resolveEndpoints({ host: "h", gamePort: "1", apiPort: "2" }, "x")).toEqual({
      endpoint: "http://h:1",
      apiPort: 2,
    });
  });

  it("uses the page protocol for the endpoint", () => {
    expect(resolveEndpoints({}, "example.com", "https:")).toEqual({
      endpoint: "https://example.com:2567",
      apiPort: 3001,
    });
    expect(resolveEndpoints({}, "example.com", "http:").endpoint).toBe("http://example.com:2567");
  });

  it("returns overrides.endpoint verbatim", () => {
    expect(resolveEndpoints({ endpoint: "wss://proxy.example/game" }, "ignored")).toEqual({
      endpoint: "wss://proxy.example/game",
      apiPort: 3001,
    });
  });

  it("returns overrides.apiBase verbatim; the manager prefers it over apiPort", () => {
    expect(
      resolveEndpoints(
        { endpoint: "wss://proxy.example/game", apiBase: "https://proxy.example/api" },
        "ignored",
      ),
    ).toEqual({
      endpoint: "wss://proxy.example/game",
      apiPort: 3001,
      apiBase: "https://proxy.example/api",
    });
  });
});

describe("readCodeParam", () => {
  it("reads a valid code, upper-cased", () => {
    expect(readCodeParam("?code=abcd", "code")).toBe("ABCD");
    expect(readCodeParam("?tv=wxyz", "tv")).toBe("WXYZ");
  });

  it("ignores a missing or malformed code", () => {
    expect(readCodeParam("", "code")).toBeUndefined();
    expect(readCodeParam("?code=ab1", "code")).toBeUndefined();
  });
});

describe("clientConfig().resolveEndpoints", () => {
  const mockEnv = (over: Record<string, string | undefined> = {}) => ({
    VITE_SERVER_HOST: undefined,
    VITE_GAME_PORT: undefined,
    VITE_API_PORT: undefined,
    VITE_SERVER_ENDPOINT: undefined,
    VITE_API_BASE: undefined,
    ...over,
  });

  it("uses the page host so LAN devices reach the right machine", () => {
    vi.stubGlobal("window", { location: { hostname: "192.168.1.50" } });
    expect(clientConfig(mockEnv()).resolveEndpoints()).toEqual({
      endpoint: "http://192.168.1.50:2567",
      apiPort: 3001,
    });
  });

  it("works on localhost", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(clientConfig(mockEnv()).resolveEndpoints().endpoint).toBe("http://localhost:2567");
  });

  it("respects the VITE_ host and port overrides", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(
      clientConfig(mockEnv({ VITE_SERVER_HOST: "10.0.0.1" })).resolveEndpoints().endpoint,
    ).toBe("http://10.0.0.1:2567");
    expect(clientConfig(mockEnv({ VITE_GAME_PORT: "9999" })).resolveEndpoints().endpoint).toBe(
      "http://localhost:9999",
    );
    expect(clientConfig(mockEnv({ VITE_API_PORT: "8080" })).resolveEndpoints().apiPort).toBe(8080);
  });

  it("returns VITE_SERVER_ENDPOINT and VITE_API_BASE verbatim", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(
      clientConfig(mockEnv({ VITE_SERVER_ENDPOINT: "wss://proxy.example/game" })).resolveEndpoints()
        .endpoint,
    ).toBe("wss://proxy.example/game");
    expect(
      clientConfig(mockEnv({ VITE_API_BASE: "https://proxy.example/api" })).resolveEndpoints()
        .apiBase,
    ).toBe("https://proxy.example/api");
  });

  it("uses the page protocol for the endpoint", () => {
    vi.stubGlobal("window", { location: { hostname: "example.com", protocol: "https:" } });
    expect(clientConfig(mockEnv()).resolveEndpoints().endpoint).toBe("https://example.com:2567");
  });

  it("falls back to the page host with no env", () => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    expect(clientConfig().resolveEndpoints().endpoint).toContain("localhost");
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
