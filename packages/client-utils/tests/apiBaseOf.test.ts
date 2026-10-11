import { describe, expect, it } from "vitest";
import { apiBaseOf } from "../src/index.js";

describe("apiBaseOf", () => {
  it("maps ws to http and wss to https", () => {
    expect(apiBaseOf("ws://example.com:2567", 3001)).toBe("http://example.com:3001");
    expect(apiBaseOf("wss://example.com", 3001)).toBe("https://example.com:3001");
  });
});
