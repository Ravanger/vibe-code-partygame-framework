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
