import { describe, expect, it } from "vitest";
import { readCodeParam, resolveEndpoints } from "../src/urls.js";

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
